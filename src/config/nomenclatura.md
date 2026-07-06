Las nomenclaruta en commits de Git ayudan a mantener un historial ordenado y fácil de entender

feat : Nueva funcionalidad
fix : Correción de errores
docs : cambios en la documentación
style : Cambios visuales o formato (sin lógica)
refactor : Reestructuración de código sin cambiar funcionalidad
perf : Mejoras de rendimiento
test : Agregar o modificar pruebas
build : Cambios en complilación o dependecias
ci : configuración de integración continua
chore : tareas menores o mantenimiento
revert : revertir commits

ejemplos de uso:

Nueva funcionalida

git commit -m "feat(producto): agregar filtro por categoria"

Corrección de bug

git commit -m "fix(login): corregir validación de contraseña"


Refactorización

git commit -m "refactor(sales): separar lógica de cálculo"



Documentación

git commit -m "docs(readme): agregar instrucciones de instalación "


# Recomendaciones

para trabajar en sistemas web e inventarios se pueden usar scopes organizados

scope          Area
auth          Login y usuarios
products      Productos
inventory     inventario
sales         ventas
reports       reportes
ui            interfaz
database      base de datos
api           backend/API


# ejemplos
-- feat(inventory): agregar alerta de stock
--fix(database): corregir relación entre ventas y productos
--style(ui): mejorar diseño del dehboard



