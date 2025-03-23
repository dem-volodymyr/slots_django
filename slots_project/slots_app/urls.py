from django.urls import path
from . import views

app_name = 'slots_app'

urlpatterns = [
    path('', views.index, name='index'),
    path('api/spin/', views.spin, name='spin'),
]