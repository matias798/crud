# EJERCICIO TO-DO LIST

## Que es to-do list ?

Simple: Es una lista de tareas.

Visualmente se compone al menos de 2 cosas: 

* Un input que permita ingresar nuevas tareas
* Una lista debajo que muestre las tareas que ya existen

## Que vamos a evaluar de este ejercicio ?

* La unica ruta que debe existir debe llamarse "/tasks"
* Que todas las rutas utilicen el metodo adecuado para cada accion (alta, baja, modificacion, etc.)
* Que al agregar una nueva tarea, se valide que texto contenga al menos 3 caracteres
* Que al enviar la nueva tarea se guarde correctamente en el archivo json
* Que se muestre el listado completo de las tareas con los datos del archivo json
* El uso correcto de EJS
* Leer y guardar el contenido de los archivos JSON correctamente
* Implementacion de la validacion con express-validator

## Dependencias

Leyendo la descripcion anterior, que dependencias necesitaras instalar primero antes de comenzar a realizar la solucion ?

## Requerimientos

- Que en /tasks se listen todas las tareas del archivo json
- Que al escribir en el campo y clickear enviar se guarde
- Que antes de guardar se valide y se muestre el error en pantalla
- Que al clickear en borrar se elimine del array y desaparezca del listado


### Listado

Existe una unica pagina donde se listan, crean y borran todos los items.

En la pagina del to-do se deben listar todas las tareas que estan en el archivo "tasks.json" en la carpeta "data".

Cada item listado debe mostrar el titulo de la tarea y ademas se debe poder clickear sobre el titulo.

### Creacion

En la pagina del listado aparecera siempre el campo de entrada.

Al escribir un texto y clickear en enviar se debera enviar la informacion a una ruta donde se guarde.

Antes de guardar se requiere validar que el texto de la tarea contenga al menos 3 caracteres. Y el mensaje de error aparecera debajo del campo de entrada de datos.

Luego de guardar debera redirigir a la misma pagina mostrando todas las tareas, para confirmar que se agrego la ultima creada.

### Borrado

Para borrar una tarea se debe pasar el mouse por encima de una tarea. Al hacerlo se visibilizara un simbolo con una equis (X) en rojo, que al clickearlo debe redirigir a la pagina donde se borrara la tarea. Una vez borrada debe volver al mismo listado.

