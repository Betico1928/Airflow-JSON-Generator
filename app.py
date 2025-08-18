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
            return False, "Debe tener exactamente 5 partes separadas por espacios"
        
        # Definir rangos válidos para cada campo
        field_ranges = [
            (0, 59, "minuto"),    # minute
            (0, 23, "hora"),      # hour
            (1, 31, "día"),       # day
            (1, 12, "mes"),       # month
            (0, 6, "día_semana")  # day of week
        ]
        
        for i, (part, (min_val, max_val, field_name)) in enumerate(zip(parts, field_ranges)):
            if not CronHelper._validate_cron_field(part, min_val, max_val):
                return False, f"Valor inválido en campo {field_name}: {part}"
        
        return True, "Expresión cron válida"
    
    @staticmethod
    def _validate_cron_field(field, min_val, max_val):
        """Valida un campo individual de cron"""
        if field == '*':
            return True
        
        # Manejar listas (valores separados por coma)
        if ',' in field:
            values = field.split(',')
            return all(CronHelper._validate_cron_field(v.strip(), min_val, max_val) for v in values)
        
        # Manejar rangos (valores separados por guión)
        if '-' in field:
            try:
                start, end = field.split('-')
                start_val, end_val = int(start), int(end)
                return (min_val <= start_val <= max_val and 
                       min_val <= end_val <= max_val and 
                       start_val <= end_val)
            except ValueError:
                return False
        
        # Manejar pasos (valores con /)
        if '/' in field:
            try:
                range_part, step_part = field.split('/')
                step = int(step_part)
                if step <= 0:
                    return False
                
                if range_part == '*':
                    return True
                else:
                    return CronHelper._validate_cron_field(range_part, min_val, max_val)
            except ValueError:
                return False
        
        # Validar valor único
        try:
            value = int(field)
            return min_val <= value <= max_val
        except ValueError:
            return False
    
    @staticmethod
    def quick_cron_options():
        """Opciones rápidas de cron comunes"""
        return {
            'every_minute': ('* * * * *', 'Cada minuto'),
            'every_5min': ('*/5 * * * *', 'Cada 5 minutos'),
            'every_15min': ('*/15 * * * *', 'Cada 15 minutos'),
            'every_30min': ('*/30 * * * *', 'Cada 30 minutos'),
            'hourly': ('0 * * * *', 'Cada hora en punto'),
            'daily_midnight': ('0 0 * * *', 'Diario a medianoche'),
            'daily_6am': ('0 6 * * *', 'Diario a las 6:00 AM'),
            'daily_9am': ('0 9 * * *', 'Diario a las 9:00 AM'),
            'daily_noon': ('0 12 * * *', 'Diario a mediodía'),
            'daily_6pm': ('0 18 * * *', 'Diario a las 6:00 PM'),
            'weekly_monday_9am': ('0 9 * * 1', 'Lunes a las 9:00 AM'),
            'weekly_friday_5pm': ('0 17 * * 5', 'Viernes a las 5:00 PM'),
            'monthly_1st_9am': ('0 9 1 * *', 'Primer día del mes a las 9:00 AM'),
            'monthly_last_day': ('0 9 L * *', 'Último día del mes a las 9:00 AM'),
            'quarterly': ('0 9 1 */3 *', 'Trimestralmente (1 enero, abril, julio, octubre)'),
            'yearly_jan_1st': ('0 9 1 1 *', 'Anualmente el 1 de enero a las 9:00 AM'),
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
    
    is_valid, message = CronHelper.validate_cron(cron_expression)
    
    return jsonify({
        'valid': is_valid,
        'message': message
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