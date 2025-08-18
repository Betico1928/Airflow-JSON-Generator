from flask import Flask, render_template, request, jsonify
import json
from datetime import datetime, timedelta
import re

app = Flask(__name__)

class CronHelper:
    """Clase para ayudar con la conversión de expresiones cron"""
    
    @staticmethod
    def validate_cron(cron_expression):
        """Valida una expresión cron básica"""
        parts = cron_expression.split()
        if len(parts) != 5:
            return False
        
        # Validación básica de formato
        patterns = [
            r'^(\*|[0-5]?[0-9]|[0-5]?[0-9]-[0-5]?[0-9]|[0-5]?[0-9]/\d+)$',  # minute
            r'^(\*|[01]?[0-9]|2[0-3]|[01]?[0-9]-2[0-3]|[01]?[0-9]/\d+)$',     # hour
            r'^(\*|[12]?[0-9]|3[01]|[12]?[0-9]-3[01]|[12]?[0-9]/\d+)$',       # day
            r'^(\*|[1-9]|1[0-2]|[1-9]-1[0-2]|[1-9]/\d+)$',                   # month
            r'^(\*|[0-6]|[0-6]-[0-6]|[0-6]/\d+)$'                            # day of week
        ]
        
        for i, part in enumerate(parts):
            if not re.match(patterns[i], part):
                return False
        return True
    
    @staticmethod
    def quick_cron_options():
        """Opciones rápidas de cron comunes"""
        return {
            'daily_midnight': ('0 0 * * *', 'Diario a medianoche'),
            'daily_6am': ('0 6 * * *', 'Diario a las 6:00 AM'),
            'daily_9am': ('0 9 * * *', 'Diario a las 9:00 AM'),
            'hourly': ('0 * * * *', 'Cada hora'),
            'every_30min': ('*/30 * * * *', 'Cada 30 minutos'),
            'weekly_monday': ('0 9 * * 1', 'Lunes a las 9:00 AM'),
            'monthly_1st': ('0 9 1 * *', 'Primer día del mes a las 9:00 AM'),
        }

class DAGConfigGenerator:
    """Generador de configuración para DAGs de Airflow"""
    
    def __init__(self):
        self.config = {
            'dag_id': '',
            'description': '',
            'schedule_interval': None,
            'start_date': '',
            'end_date': None,
            'catchup': False,
            'max_active_runs': 1,
            'tags': [],
            'default_args': {
                'owner': 'airflow',
                'depends_on_past': False,
                'email_on_failure': False,
                'email_on_retry': False,
                'retries': 1,
                'retry_delay': 300  # en segundos
            },
            'tasks': []
        }
    
    def set_basic_config(self, config_data):
        """Establece la configuración básica del DAG"""
        for key, value in config_data.items():
            if key in self.config:
                if key == 'tags' and isinstance(value, str):
                    self.config[key] = [tag.strip() for tag in value.split(',') if tag.strip()]
                elif key == 'retry_delay' and isinstance(value, (int, float)):
                    self.config['default_args']['retry_delay'] = int(value)
                elif key in ['retries', 'max_active_runs'] and isinstance(value, (int, float)):
                    if key == 'retries':
                        self.config['default_args'][key] = int(value)
                    else:
                        self.config[key] = int(value)
                elif key in ['email_on_failure', 'email_on_retry', 'depends_on_past', 'catchup']:
                    if key in ['email_on_failure', 'email_on_retry', 'depends_on_past']:
                        self.config['default_args'][key] = bool(value)
                    else:
                        self.config[key] = bool(value)
                else:
                    self.config[key] = value
    
    def add_task(self, task_config):
        """Añade una tarea al DAG"""
        task = {
            'task_id': task_config.get('task_id', ''),
            'task_type': task_config.get('task_type', 'BashOperator'),
            'parameters': task_config.get('parameters', {}),
            'dependencies': task_config.get('dependencies', [])
        }
        self.config['tasks'].append(task)
    
    def generate_json(self):
        """Genera el JSON final"""
        return json.dumps(self.config, indent=2, ensure_ascii=False)
    
    def validate_config(self):
        """Valida la configuración actual"""
        errors = []
        
        if not self.config['dag_id']:
            errors.append("DAG ID es requerido")
        
        if not self.config['start_date']:
            errors.append("Fecha de inicio es requerida")
        
        if self.config['schedule_interval'] and not CronHelper.validate_cron(self.config['schedule_interval']):
            errors.append("Expresión cron inválida")
        
        return errors

@app.route('/')
def index():
    """Página principal"""
    cron_options = CronHelper.quick_cron_options()
    return render_template('index.html', cron_options=cron_options)

@app.route('/validate_cron', methods=['POST'])
def validate_cron():
    """Valida una expresión cron"""
    data = request.get_json()
    cron_expression = data.get('cron', '')
    
    is_valid = CronHelper.validate_cron(cron_expression)
    
    return jsonify({
        'valid': is_valid,
        'message': 'Expresión cron válida' if is_valid else 'Expresión cron inválida'
    })

@app.route('/generate_config', methods=['POST'])
def generate_config():
    """Genera la configuración JSON del DAG"""
    try:
        data = request.get_json()
        
        generator = DAGConfigGenerator()
        generator.set_basic_config(data.get('dag_config', {}))
        
        # Agregar tareas si las hay
        for task in data.get('tasks', []):
            generator.add_task(task)
        
        # Validar configuración
        errors = generator.validate_config()
        if errors:
            return jsonify({
                'success': False,
                'errors': errors
            })
        
        # Generar JSON
        config_json = generator.generate_json()
        
        return jsonify({
            'success': True,
            'config': config_json,
            'config_object': generator.config
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'errors': [f'Error interno: {str(e)}']
        })

@app.route('/task_templates')
def task_templates():
    """Devuelve plantillas de tareas comunes"""
    templates = {
        'BashOperator': {
            'bash_command': '',
            'env': {},
            'cwd': None
        },
        'PythonOperator': {
            'python_callable': '',
            'op_args': [],
            'op_kwargs': {}
        },
        'EmailOperator': {
            'to': '',
            'subject': '',
            'html_content': '',
            'files': []
        },
        'HttpSensor': {
            'endpoint': '',
            'request_params': {},
            'timeout': 20,
            'poke_interval': 60
        },
        'SqlOperator': {
            'sql': '',
            'conn_id': 'default_db'
        }
    }
    
    return jsonify(templates)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)