from django.contrib import admin

# Register your models here.
from .models import Carrinho
from .models import Sorvete
from .models import Reserva
from .models import Cliente


admin.site.register(Carrinho)
admin.site.register(Sorvete)
admin.site.register(Reserva)
admin.site.register(Cliente)