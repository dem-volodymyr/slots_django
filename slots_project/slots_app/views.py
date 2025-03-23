import json
import random
from decimal import Decimal

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Player, Machine

# Symbols configuration
SYMBOLS = {
    'diamond': 'diamond',
    'floppy': 'floppy',
    'hourglass': 'hourglass',
    'seven': 'seven', # Same image as hourglass but counts as different symbol
    'telephone': 'telephone'
}


def get_player(request):
    """Get or create a player associated with the current session"""
    session_id = request.session.session_key
    if not session_id:
        request.session.create()
        session_id = request.session.session_key

    player, created = Player.objects.get_or_create(
        session_id=session_id,
        defaults={'balance': 1000.00, 'bet_size': 10.00}
    )
    return player


def index(request):
    """Main view for the slots game"""
    player = get_player(request)

    # Get machine singleton or create if it doesn't exist
    machine, created = Machine.objects.get_or_create(
        pk=1,
        defaults={'balance': 10000.00}
    )

    context = {
        'player': player,
        'machine': machine,
        'symbols': json.dumps(list(SYMBOLS.values())),
    }
    return render(request, 'slots_app/index.html', context)


def flip_horizontal(result):
    """Helper function to flip results horizontally"""
    horizontal_values = list(result.values())
    rows, cols = len(horizontal_values), len(horizontal_values[0])
    hvals2 = [[""] * rows for _ in range(cols)]
    for x in range(rows):
        for y in range(cols):
            hvals2[y][rows - x - 1] = horizontal_values[x][y]
    hvals3 = [item[::-1] for item in hvals2]
    return hvals3


def longest_seq(hit):
    """Helper function to find longest sequence in a hit"""
    subSeqLength, longest = 1, 1
    start, end = 0, 0
    for i in range(len(hit) - 1):
        if hit[i] == hit[i + 1] - 1:
            subSeqLength += 1
            if subSeqLength > longest:
                longest = subSeqLength
                start = i + 2 - subSeqLength
                end = i + 2
        else:
            subSeqLength = 1
    return hit[start:end]


def check_wins(result):
    """Check for wins in the result"""
    hits = {}
    horizontal = flip_horizontal(result)
    for row in horizontal:
        for sym in row:
            if row.count(sym) > 2:  # Potential win
                possible_win = [idx for idx, val in enumerate(row) if sym == val]
                # Check possible_win for a subsequence longer than 2 and add to hits
                if len(longest_seq(possible_win)) > 2:
                    hits[horizontal.index(row) + 1] = [sym, longest_seq(possible_win)]
    return hits if hits else None


@csrf_exempt
def spin(request):
    """API endpoint to handle spins"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST requests allowed'}, status=405)

    player = get_player(request)
    machine, _ = Machine.objects.get_or_create(pk=1, defaults={'balance': 10000.00})

    # Check if player has enough balance
    if player.balance < player.bet_size:
        return JsonResponse({'error': 'Insufficient balance'}, status=400)

    # Place bet and update machine balance
    success = player.place_bet()
    if not success:
        return JsonResponse({'error': 'Failed to place bet'}, status=400)

    machine.update_balance(player.bet_size)

    # Generate spin results (5 reels, 3 rows)
    symbols_list = list(SYMBOLS.keys())
    result = {}
    for reel in range(5):
        result[reel] = [random.choice(symbols_list) for _ in range(3)]

    # Check for wins
    win_data = check_wins(result)
    payout = 0

    if win_data:
        # Calculate payout based on win patterns
        multiplier = 0
        for v in win_data.values():
            multiplier += len(v[1])
        payout = Decimal(multiplier) * player.bet_size

        # Update player balance and machine balance
        player.add_win(payout)
        machine.update_balance(-payout)
    else:
        # Reset last payout if no win
        player.last_payout = 0
        player.save()

    # Return results to frontend
    return JsonResponse({
        'result': result,
        'win_data': win_data,
        'payout': float(payout),
        'player_data': player.get_data(),
        'machine_balance': float(machine.balance)
    })