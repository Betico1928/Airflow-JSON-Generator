# Airflow JSON Generator

Generador de Configuración DAG para Apache Airflow
Una aplicación web intuitiva que facilita la creación de archivos JSON de configuración para DAGs de Apache Airflow. Con una interfaz de usuario moderna y tooltips informativos, permite configurar todos los parámetros del DAG de forma dinámica.
🚀 Características

Interfaz web moderna y responsiva con Bootstrap 5
Configuración completa del DAG: horarios cron, fechas, tags, reintentos, etc.
Selector de cron inteligente con opciones rápidas y validación en tiempo real
Gestión dinámica de tareas con plantillas para diferentes tipos de operadores
Tooltips informativos para cada campo con explicaciones detalladas
Vista previa en tiempo real del JSON generado
Validación de configuración antes de generar el archivo
Descarga y copia del JSON resultante
Soporte para múltiples tipos de tareas: Bash, Python, Email, HTTP Sensor, SQL

📋 Requisitos Previos

Python 3.7 o superior
pip (gestor de paquetes de Python)

🛠️ Instalación

Clonar o descargar los archivos del proyecto en tu repositorio local
Crear un entorno virtual (recomendado):
bashpython -m venv airflow_dag_generator
source airflow_dag_generator/bin/activate  # En Windows: airflow_dag_generator\Scripts\activate

Instalar las dependencias:
bashpip install -r requirements.txt

Crear la estructura de directorios:
tu_proyecto/
├── app.py
├── requirements.txt
├── README.md
├── templates/
│   └── index.html
└── static/
    ├── js/
    │   └── app.js
    └── css/
        └── style.css


🎯 Estructura del Proyecto
airflow-dag-generator/
│
├── app.py                 # Servidor Flask principal
├── requirements.txt       # Dependencias de Python
├── README.md             # Este archivo
│
├── templates/
│   └── index.html        # Interfaz de usuario principal
│
└── static/
    ├── js/
    │   └── app.js        # Lógica del frontend
    └── css/
        └── style.css     # Estilos personalizados
🚀 Ejecución

Activar el entorno virtual (si no está activado):
bashsource airflow_dag_generator/bin/activate  # En Windows: airflow_dag_generator\Scripts\activate

Ejecutar la aplicación:
bashpython app.py

Abrir el navegador y navegar a: http://localhost:5000

📖 Guía de Uso
1. Configuración Básica del DAG

DAG ID: Identificador único para tu DAG
Descripción: Descripción del propósito del DAG
Programación: Selecciona una opción rápida de cron o escribe tu propia expresión
Fechas: Configura las fechas de inicio y fin
Tags: Agrega etiquetas separadas por coma para organizar tus DAGs
Configuraciones avanzadas: Reintentos, emails, dependencias, etc.

2. Agregar Tareas

Haz clic en "Agregar Tarea"
Selecciona el tipo de tarea (Bash, Python, Email, etc.)
Configura los parámetros específicos según el tipo de operador
Define dependencias si es necesario
Guarda la tarea

3. Generar Configuración

Completa toda la configuración del DAG y tareas
Haz clic en "Generar Configuración"
Revisa la vista previa del JSON
Copia o descarga el archivo JSON resultante

🔧 Tipos de Tareas Soportadas
Bash Operator

Ejecuta comandos bash
Configura variables de entorno y directorio de trabajo

Python Operator

Ejecuta funciones Python
Configura argumentos y parámetros

Email Operator

Envía emails
Configura destinatarios, asunto y contenido

HTTP Sensor

Monitorea endpoints HTTP
Configura timeouts y intervalos de verificación

SQL Operator

Ejecuta consultas SQL
Configura conexión a base de datos

🎨 Características de la Interfaz

Tooltips informativos: Pasa el mouse sobre los iconos "i" para obtener ayuda
Validación en tiempo real: Los campos se validan mientras escribes
Vista previa dinámica: Ve el JSON generándose en tiempo real
Selector de cron inteligente: Botones rápidos para expresiones cron comunes
Interfaz responsiva: Funciona en desktop, tablet y móvil

🔍 Validaciones Incluidas

Expresiones cron: Validación automática de sintaxis
DAG ID único: Evita duplicados
Campos requeridos: Valida campos obligatorios
Fechas consistentes: Verifica que las fechas sean lógicas
JSON válido: Asegura que la salida sea JSON válido

📝 Ejemplo de Configuración Generada
json{
  "dag_id": "mi_dag_ejemplo",
  "description": "DAG de ejemplo para procesamiento de datos",
  "schedule_interval": "0 9 * * *",
  "start_date": "2024-01-01T09:00:00",
  "end_date": null,
  "catchup": false,
  "max_active_runs": 1,
  "tags": ["etl", "produccion", "diario"],
  "default_args": {
    "owner": "data_team",
    "depends_on_past": false,
    "email_on_failure": true,
    "email_on_retry": false,
    "retries": 2,
    "retry_delay": 300
  },
  "tasks": [
    {
      "task_id": "extract_data",
      "task_type": "BashOperator",
      "parameters": {
        "bash_command": "python /scripts/extract.py"
      },
      "dependencies": []
    },
    {
      "task_id": "transform_data",
      "task_type": "PythonOperator",
      "parameters": {
        "python_callable": "transform_function",
        "op_args": ["input_file", "output_file"]
      },
      "dependencies": ["extract_data"]
    }
  ]
}
🛡️ Solución de Problemas
Error: "Módulo no encontrado"

Asegúrate de que el entorno virtual esté activado
Instala las dependencias: pip install -r requirements.txt

Error: "Puerto en uso"

El puerto 5000 está ocupado, cambia el puerto en app.py:
pythonapp.run(debug=True, host='0.0.0.0', port=5001)


Error: "Plantillas no encontradas"

Verifica que la estructura de carpetas sea correcta
Asegúrate de que templates/index.html exista

🔄 Personalización
Agregar nuevos tipos de tareas:

Modifica el método task_templates() en app.py
Agrega la nueva opción en el select de index.html
Actualiza la lógica en app.js si es necesario

Cambiar estilos:

Modifica static/css/style.css para personalizar la apariencia
Usa variables CSS para cambios rápidos de colores

Agregar validaciones:

Extiende el método validate_config() en app.py
Agrega validaciones del lado del cliente en app.js

🤝 Contribución

Fork el proyecto
Crea una rama para tu característica (git checkout -b feature/AmazingFeature)
Commit tus cambios (git commit -m 'Add some AmazingFeature')
Push a la rama (git push origin feature/AmazingFeature)
Abre un Pull Request

📄 Licencia
Este proyecto está bajo la Licencia MIT. Ve el archivo LICENSE para más detalles.
👨‍💻 Soporte
Si tienes problemas o preguntas:

Revisa la sección de Solución de Problemas
Verifica que todos los archivos estén en su lugar correcto
Asegúrate de que las dependencias estén instaladas correctamente

🎯 Próximas Características

 Importar configuraciones existentes
 Plantillas de DAG predefinidas
 Validación de conexiones de Airflow
 Exportación a diferentes formatos
 Modo oscuro
 Guardado automático en localStorage
 Historial de configuraciones


¡Disfruta creando tus DAGs de Airflow de manera más eficiente! 🚀