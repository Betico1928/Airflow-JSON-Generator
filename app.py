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
                'email_on_success': False,
                'retries': 1,
                'retry_delay': 300,  # en segundos
                'retry_exponential_backoff': False,
                'max_retry_delay': None,
                'execution_timeout': None,
                'timeout': None,
                'email': [],
                'on_failure_callback': None,
                'on_success_callback': None,
                'on_retry_callback': None,
                'trigger_rule': 'all_success',
                'pool': None,
                'pool_slots': 1,
                'priority_weight': 1,
                'weight_rule': 'downstream',
                'queue': 'default',
                'sla': None,
                'provide_context': True
            },
            'concurrency': None,
            'max_active_tasks': None,
            'dagrun_timeout': None,
            'sla_miss_callback': None,
            'default_view': 'graph',
            'orientation': 'LR',
            'is_paused_upon_creation': True,
            'access_control': {},
            'params': {},
            'doc_md': None,
            'render_template_as_native_obj': False
        }
    
    def set_basic_config(self, config_data):
        """Establece la configuración básica del DAG"""
        for key, value in config_data.items():
            # Procesar tags
            if key == 'tags' and isinstance(value, str):
                self.config[key] = [tag.strip() for tag in value.split(',') if tag.strip()]
            
            # Procesar emails
            elif key == 'email' and isinstance(value, str):
                emails = [email.strip() for email in value.split(',') if email.strip()]
                self.config['default_args']['email'] = emails
            
            # Procesar valores numéricos del default_args
            elif key in ['retry_delay', 'max_retry_delay', 'execution_timeout', 'timeout', 'pool_slots', 
                        'priority_weight', 'sla'] and isinstance(value, (int, float, str)):
                if value and str(value).strip():
                    try:
                        numeric_value = int(float(value))
                        self.config['default_args'][key] = numeric_value if numeric_value > 0 else None
                    except (ValueError, TypeError):
                        pass
            
            # Procesar valores numéricos del config principal
            elif key in ['retries', 'max_active_runs', 'concurrency', 'max_active_tasks', 
                        'dagrun_timeout'] and isinstance(value, (int, float, str)):
                if value and str(value).strip():
                    try:
                        numeric_value = int(float(value))
                        if key == 'retries':
                            self.config['default_args'][key] = numeric_value
                        else:
                            self.config[key] = numeric_value if numeric_value > 0 else None
                    except (ValueError, TypeError):
                        pass
            
            # Procesar valores booleanos del default_args
            elif key in ['email_on_failure', 'email_on_retry', 'email_on_success', 'depends_on_past', 
                        'retry_exponential_backoff', 'provide_context']:
                self.config['default_args'][key] = bool(value)
            
            # Procesar valores booleanos del config principal
            elif key in ['catchup', 'is_paused_upon_creation', 'render_template_as_native_obj']:
                self.config[key] = bool(value)
            
            # Procesar valores de texto del default_args
            elif key in ['trigger_rule', 'pool', 'weight_rule', 'queue']:
                if value and str(value).strip():
                    self.config['default_args'][key] = str(value).strip()
            
            # Procesar valores de texto del config principal
            elif key in ['default_view', 'orientation', 'doc_md']:
                if value and str(value).strip():
                    self.config[key] = str(value).strip()
            
            # Procesar callbacks (functions como strings)
            elif key in ['on_failure_callback', 'on_success_callback', 'on_retry_callback', 'sla_miss_callback']:
                if value and str(value).strip():
                    self.config['default_args' if key.startswith('on_') else 'config'][key] = str(value).strip()
            
            # Procesar access_control como JSON
            elif key == 'access_control' and value:
                try:
                    if isinstance(value, str):
                        self.config[key] = json.loads(value)
                    else:
                        self.config[key] = value
                except (json.JSONDecodeError, TypeError):
                    pass
            
            # Procesar params como JSON
            elif key == 'params' and value:
                try:
                    if isinstance(value, str):
                        self.config[key] = json.loads(value)
                    else:
                        self.config[key] = value
                except (json.JSONDecodeError, TypeError):
                    pass
            
            # Valores directos
            elif key in self.config:
                self.config[key] = value
        
        # Limpiar valores None o vacíos
        self._clean_config()
    
    def _clean_config(self):
        """Limpia valores None o vacíos de la configuración"""
        # Limpiar default_args
        self.config['default_args'] = {
            k: v for k, v in self.config['default_args'].items() 
            if v is not None and v != '' and v != []
        }
        
        # Limpiar config principal
        clean_config = {}
        for k, v in self.config.items():
            if k == 'default_args':
                clean_config[k] = self.config['default_args']
            elif v is not None and v != '' and v != [] and v != {}:
                clean_config[k] = v
        
        self.config = clean_config
    
    def add_custom_objects(self, custom_objects):
        """Añade objetos JSON personalizados al config"""
        if custom_objects:
            self.config.update(custom_objects)
    
    def generate_json(self):
        """Genera el JSON final"""
        return json.dumps(self.config, indent=2, ensure_ascii=False)
    
    def validate_config(self):
        """Valida la configuración actual"""
        errors = []
        
        if not self.config.get('dag_id'):
            errors.append("DAG ID es requerido")
        
        if not self.config.get('start_date'):
            errors.append("Fecha de inicio es requerida")
        
        # Validar emails si están presentes
        emails = self.config.get('default_args', {}).get('email', [])
        if emails:
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            for email in emails:
                if not re.match(email_pattern, email):
                    errors.append(f"Email inválido: {email}")
        
        # Validar cron si está presente
        if self.config.get('schedule_interval'):
            is_valid, message = CronHelper.validate_cron(self.config['schedule_interval'])
            if not is_valid:
                errors.append(f"Expresión cron inválida: {message}")
        
        # Validar trigger_rule
        valid_trigger_rules = [
            'all_success', 'all_failed', 'all_done', 'one_success', 
            'one_failed', 'none_failed', 'none_skipped', 'dummy'
        ]
        trigger_rule = self.config.get('default_args', {}).get('trigger_rule')
        if trigger_rule and trigger_rule not in valid_trigger_rules:
            errors.append(f"Trigger rule inválido: {trigger_rule}")
        
        # Validar weight_rule
        valid_weight_rules = ['downstream', 'upstream', 'absolute']
        weight_rule = self.config.get('default_args', {}).get('weight_rule')
        if weight_rule and weight_rule not in valid_weight_rules:
            errors.append(f"Weight rule inválido: {weight_rule}")
        
        # Validar default_view
        valid_default_views = ['tree', 'graph', 'duration', 'gantt', 'landing_times']
        default_view = self.config.get('default_view')
        if default_view and default_view not in valid_default_views:
            errors.append(f"Default view inválido: {default_view}")
        
        # Validar orientation
        valid_orientations = ['LR', 'TB', 'RL', 'BT']
        orientation = self.config.get('orientation')
        if orientation and orientation not in valid_orientations:
            errors.append(f"Orientación inválida: {orientation}")
        
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
        
        # Agregar objetos JSON personalizados
        custom_objects = data.get('custom_objects', {})
        generator.add_custom_objects(custom_objects)
        
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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)