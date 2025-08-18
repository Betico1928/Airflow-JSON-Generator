class DAGGenerator {
    constructor() {
        this.tasks = [];
        this.taskTemplates = {};
        this.taskCounter = 0;
        this.currentConfig = {};
        
        this.initializeEventListeners();
        this.initializeTooltips();
        this.loadTaskTemplates();
        this.setDefaultDateTime();
    }
    
    initializeEventListeners() {
        // Botones principales
        document.getElementById('generateConfigBtn').addEventListener('click', () => this.generateConfiguration());
        document.getElementById('resetFormBtn').addEventListener('click', () => this.resetForm());
        document.getElementById('addTaskBtn').addEventListener('click', () => this.showTaskModal());
        document.getElementById('saveTaskBtn').addEventListener('click', () => this.saveTask());
        
        // Botones de vista previa
        document.getElementById('copyJsonBtn').addEventListener('click', () => this.copyJson());
        document.getElementById('downloadJsonBtn').addEventListener('click', () => this.downloadJson());
        
        // Validación de cron en tiempo real
        document.getElementById('schedule_interval').addEventListener('input', (e) => this.validateCron(e.target.value));
        
        // Botones de cron rápido
        document.querySelectorAll('.cron-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cronExpression = e.target.dataset.cron;
                document.getElementById('schedule_interval').value = cronExpression;
                this.validateCron(cronExpression);
            });
        });
        
        // Cambio de tipo de tarea en el modal
        document.getElementById('task_type').addEventListener('change', (e) => this.loadTaskParameters(e.target.value));
        
        // Auto-generar vista previa cuando cambian los campos
        this.setupAutoPreview();
    }
    
    initializeTooltips() {
        // Inicializar todos los tooltips de Bootstrap
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
    
    setDefaultDateTime() {
        // Establecer fecha y hora actual como predeterminada
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('start_date').value = localDateTime;
    }
    
    async loadTaskTemplates() {
        try {
            const response = await fetch('/task_templates');
            this.taskTemplates = await response.json();
        } catch (error) {
            console.error('Error cargando plantillas de tareas:', error);
            this.showAlert('Error cargando plantillas de tareas', 'danger');
        }
    }
    
    setupAutoPreview() {
        // Lista de campos a monitorear para auto-preview
        const fieldsToWatch = [
            'dag_id', 'description', 'schedule_interval', 'start_date', 'end_date',
            'tags', 'max_active_runs', 'owner', 'catchup', 'depends_on_past',
            'email_on_failure', 'email_on_retry', 'retries', 'retry_delay'
        ];
        
        fieldsToWatch.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.addEventListener('input', () => this.updatePreview());
                element.addEventListener('change', () => this.updatePreview());
            }
        });
    }
    
    async validateCron(cronExpression) {
        if (!cronExpression.trim()) {
            this.setCronValidation('', '');
            return;
        }
        
        try {
            const response = await fetch('/validate_cron', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ cron: cronExpression })
            });
            
            const result = await response.json();
            const isValid = result.valid;
            const message = result.message;
            
            this.setCronValidation(isValid ? 'is-valid' : 'is-invalid', message);
        } catch (error) {
            console.error('Error validando cron:', error);
            this.setCronValidation('is-invalid', 'Error validando expresión');
        }
    }
    
    setCronValidation(className, message) {
        const input = document.getElementById('schedule_interval');
        const feedback = document.getElementById('cronValidation');
        
        // Limpiar clases anteriores
        input.classList.remove('is-valid', 'is-invalid');
        
        // Aplicar nueva clase si hay una
        if (className) {
            input.classList.add(className);
        }
        
        // Establecer mensaje
        feedback.textContent = message;
        feedback.className = `validation-feedback ${className === 'is-valid' ? 'text-success' : 'text-danger'}`;
    }
    
    showTaskModal() {
        // Limpiar el formulario
        document.getElementById('taskForm').reset();
        
        // Cargar parámetros para el tipo predeterminado
        this.loadTaskParameters('BashOperator');
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('taskModal'));
        modal.show();
    }
    
    loadTaskParameters(taskType) {
        const container = document.getElementById('taskParameters');
        const template = this.taskTemplates[taskType] || {};
        
        container.innerHTML = '';
        
        Object.entries(template).forEach(([paramName, defaultValue]) => {
            const div = document.createElement('div');
            div.className = 'mb-3';
            
            const label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = this.formatParameterName(paramName);
            
            const input = this.createInputForParameter(paramName, defaultValue);
            input.name = paramName;
            input.id = `param_${paramName}`;
            
            div.appendChild(label);
            div.appendChild(input);
            container.appendChild(div);
        });
    }
    
    formatParameterName(paramName) {
        return paramName.replace(/_/g, ' ')
                       .split(' ')
                       .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                       .join(' ');
    }
    
    createInputForParameter(paramName, defaultValue) {
        const input = document.createElement('input');
        input.className = 'form-control';
        
        if (typeof defaultValue === 'boolean') {
            input.type = 'checkbox';
            input.className = 'form-check-input';
            input.checked = defaultValue;
        } else if (typeof defaultValue === 'number') {
            input.type = 'number';
            input.value = defaultValue;
        } else if (Array.isArray(defaultValue)) {
            input.type = 'text';
            input.placeholder = 'Valores separados por coma';
            input.value = defaultValue.join(', ');
        } else if (typeof defaultValue === 'object') {
            input.type = 'text';
            input.placeholder = 'JSON válido';
            input.value = JSON.stringify(defaultValue);
        } else {
            input.type = 'text';
            input.value = defaultValue || '';
        }
        
        // Añadir placeholders específicos
        if (paramName === 'bash_command') {
            input.placeholder = 'echo "Hello World"';
        } else if (paramName === 'python_callable') {
            input.placeholder = 'my_function';
        } else if (paramName === 'sql') {
            input.placeholder = 'SELECT * FROM my_table';
        } else if (paramName === 'endpoint') {
            input.placeholder = '/api/status';
        }
        
        return input;
    }
    
    saveTask() {
        const form = document.getElementById('taskForm');
        const formData = new FormData(form);
        
        const task = {
            task_id: formData.get('task_id'),
            task_type: formData.get('task_type'),
            parameters: {},
            dependencies: formData.get('dependencies') ? 
                         formData.get('dependencies').split(',').map(s => s.trim()).filter(s => s) : []
        };
        
        // Recopilar parámetros
        const paramInputs = document.querySelectorAll('#taskParameters input');
        paramInputs.forEach(input => {
            const paramName = input.name;
            let value = input.value;
            
            if (input.type === 'checkbox') {
                value = input.checked;
            } else if (input.type === 'number') {
                value = parseInt(value) || 0;
            } else if (value.startsWith('[') || value.startsWith('{')) {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    // Si no es JSON válido, mantener como string
                }
            } else if (paramName.includes('args') && value.includes(',')) {
                value = value.split(',').map(s => s.trim()).filter(s => s);
            }
            
            task.parameters[paramName] = value;
        });
        
        // Validar que el task_id sea único
        if (this.tasks.some(t => t.task_id === task.task_id)) {
            this.showAlert('Ya existe una tarea con ese ID', 'warning');
            return;
        }
        
        this.tasks.push(task);
        this.renderTasks();
        this.updatePreview();
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
        modal.hide();
        
        this.showAlert(`Tarea "${task.task_id}" agregada exitosamente`, 'success');
    }
    
    renderTasks() {
        const container = document.getElementById('tasksContainer');
        
        if (this.tasks.length === 0) {
            container.innerHTML = '<p class="text-muted">No hay tareas configuradas. Haz clic en "Agregar Tarea" para comenzar.</p>';
            return;
        }
        
        container.innerHTML = '';
        
        this.tasks.forEach((task, index) => {
            const taskCard = document.createElement('div');
            taskCard.className = 'task-card p-3';
            taskCard.innerHTML = `
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0">
                        <i class="fas fa-play-circle text-primary"></i>
                        ${task.task_id}
                    </h6>
                    <div>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="dagGenerator.editTask(${index})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="dagGenerator.removeTask(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <p class="mb-1"><strong>Tipo:</strong> ${task.task_type}</p>
                ${task.dependencies.length > 0 ? `<p class="mb-1"><strong>Dependencias:</strong> ${task.dependencies.join(', ')}</p>` : ''}
                <div class="mt-2">
                    <small class="text-muted">
                        <strong>Parámetros:</strong> ${Object.keys(task.parameters).length} configurados
                    </small>
                </div>
            `;
            
            container.appendChild(taskCard);
        });
    }
    
    editTask(index) {
        const task = this.tasks[index];
        
        // Llenar el formulario con los datos de la tarea
        document.getElementById('task_id').value = task.task_id;
        document.getElementById('task_type').value = task.task_type;
        document.getElementById('dependencies').value = task.dependencies.join(', ');
        
        // Cargar parámetros y llenar valores
        this.loadTaskParameters(task.task_type);
        
        setTimeout(() => {
            Object.entries(task.parameters).forEach(([paramName, value]) => {
                const input = document.getElementById(`param_${paramName}`);
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = value;
                    } else if (typeof value === 'object') {
                        input.value = JSON.stringify(value);
                    } else if (Array.isArray(value)) {
                        input.value = value.join(', ');
                    } else {
                        input.value = value;
                    }
                }
            });
        }, 100);
        
        // Remover la tarea actual y mostrar modal
        this.tasks.splice(index, 1);
        this.renderTasks();
        
        const modal = new bootstrap.Modal(document.getElementById('taskModal'));
        modal.show();
    }
    
    removeTask(index) {
        if (confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
            const task = this.tasks[index];
            this.tasks.splice(index, 1);
            this.renderTasks();
            this.updatePreview();
            this.showAlert(`Tarea "${task.task_id}" eliminada`, 'info');
        }
    }
    
    async generateConfiguration() {
        const form = document.getElementById('dagConfigForm');
        const formData = new FormData(form);
        
        const dagConfig = {};
        
        // Recopilar datos del formulario
        for (let [key, value] of formData.entries()) {
            if (key === 'tags') {
                dagConfig[key] = value;
            } else if (['max_active_runs', 'retries', 'retry_delay'].includes(key)) {
                dagConfig[key] = parseInt(value) || (key === 'max_active_runs' ? 1 : 0);
            } else if (['catchup', 'depends_on_past', 'email_on_failure', 'email_on_retry'].includes(key)) {
                dagConfig[key] = document.getElementById(key).checked;
            } else {
                dagConfig[key] = value;
            }
        }
        
        // Preparar datos para enviar
        const payload = {
            dag_config: dagConfig,
            tasks: this.tasks
        };
        
        try {
            const response = await fetch('/generate_config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentConfig = JSON.parse(result.config);
                this.updateJsonPreview(result.config);
                this.showAlert('Configuración generada exitosamente', 'success');
            } else {
                const errors = result.errors.join('<br>');
                this.showAlert(`Errores en la configuración:<br>${errors}`, 'danger');
            }
        } catch (error) {
            console.error('Error generando configuración:', error);
            this.showAlert('Error generando la configuración', 'danger');
        }
    }
    
    updatePreview() {
        // Generar una vista previa básica sin validación completa
        const form = document.getElementById('dagConfigForm');
        const formData = new FormData(form);
        
        const preview = {
            dag_id: formData.get('dag_id') || 'mi_dag',
            description: formData.get('description') || '',
            schedule_interval: formData.get('schedule_interval') || null,
            start_date: formData.get('start_date') || '',
            end_date: formData.get('end_date') || null,
            catchup: document.getElementById('catchup').checked,
            max_active_runs: parseInt(formData.get('max_active_runs')) || 1,
            tags: formData.get('tags') ? formData.get('tags').split(',').map(t => t.trim()).filter(t => t) : [],
            tasks_count: this.tasks.length,
            tasks: this.tasks.map(task => ({
                task_id: task.task_id,
                task_type: task.task_type,
                dependencies: task.dependencies
            }))
        };
        
        this.updateJsonPreview(JSON.stringify(preview, null, 2));
    }
    
    updateJsonPreview(jsonString) {
        document.getElementById('jsonPreview').textContent = jsonString;
    }
    
    copyJson() {
        const jsonText = document.getElementById('jsonPreview').textContent;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(jsonText).then(() => {
                this.showAlert('JSON copiado al portapapeles', 'success');
            }).catch(() => {
                this.fallbackCopyTextToClipboard(jsonText);
            });
        } else {
            this.fallbackCopyTextToClipboard(jsonText);
        }
    }
    
    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showAlert('JSON copiado al portapapeles', 'success');
            } else {
                this.showAlert('No se pudo copiar al portapapeles', 'warning');
            }
        } catch (err) {
            this.showAlert('Error copiando al portapapeles', 'danger');
        }
        
        document.body.removeChild(textArea);
    }
    
    downloadJson() {
        const jsonText = document.getElementById('jsonPreview').textContent;
        const dagId = document.getElementById('dag_id').value || 'dag_config';
        
        const blob = new Blob([jsonText], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${dagId}_config.json`;
        
        document.body.appendChild(a);
        a.click();
        
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        this.showAlert('Configuración descargada', 'success');
    }
    
    resetForm() {
        if (confirm('¿Estás seguro de que quieres limpiar todo el formulario?')) {
            // Limpiar formulario principal
            document.getElementById('dagConfigForm').reset();
            
            // Limpiar tareas
            this.tasks = [];
            this.renderTasks();
            
            // Restaurar valores por defecto
            this.setDefaultDateTime();
            document.getElementById('max_active_runs').value = '1';
            document.getElementById('owner').value = 'airflow';
            document.getElementById('retries').value = '1';
            document.getElementById('retry_delay').value = '300';
            
            // Limpiar validación de cron
            this.setCronValidation('', '');
            
            // Limpiar vista previa
            this.updateJsonPreview('{\n  "message": "Configura el DAG para ver la vista previa"\n}');
            
            this.showAlert('Formulario reiniciado', 'info');
        }
    }
    
    showAlert(message, type = 'info') {
        // Crear elemento de alerta
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.top = '20px';
        alertDiv.style.right = '20px';
        alertDiv.style.zIndex = '9999';
        alertDiv.style.minWidth = '300px';
        
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.dagGenerator = new DAGGenerator();
});
            