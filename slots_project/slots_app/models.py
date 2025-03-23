from django.db import models
from django.contrib.auth.models import User


class Player(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True)
    session_id = models.CharField(max_length=100, null=True, blank=True)
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=1000.00)
    bet_size = models.DecimalField(max_digits=10, decimal_places=2, default=10.00)
    last_payout = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_won = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_wager = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    def __str__(self):
        if self.user:
            return f"Player: {self.user.username}"
        return f"Anonymous Player: {self.session_id}"

    def place_bet(self):
        if self.balance >= self.bet_size:
            self.balance -= self.bet_size
            self.total_wager += self.bet_size
            self.save()
            return True
        return False

    def add_win(self, amount):
        self.last_payout = amount
        self.balance += amount
        self.total_won += amount
        self.save()

    def get_data(self):
        return {
            'balance': f"{self.balance:.2f}",
            'bet_size': f"{self.bet_size:.2f}",
            'last_payout': f"{self.last_payout:.2f}" if self.last_payout else "N/A",
            'total_won': f"{self.total_won:.2f}",
            'total_wager': f"{self.total_wager:.2f}"
        }


class Machine(models.Model):
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=10000.00)

    def update_balance(self, amount):
        self.balance += amount
        self.save()

    def __str__(self):
        return f"Slot Machine (Balance: ${self.balance:.2f})"