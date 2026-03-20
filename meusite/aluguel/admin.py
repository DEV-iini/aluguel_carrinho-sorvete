from django.contrib import admin

# Register your models here.
from .models import Carrinho
from .models import Sorvete

admin.site.register(Carrinho)
admin.site.register(Sorvete)