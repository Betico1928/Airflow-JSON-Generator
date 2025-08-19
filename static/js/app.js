class DAGGenerator {
    constructor() {
        this.jsonObjects = {};  // Cambio de tasks a jsonObjects
        this.currentEditingObject = null;
        this.currentObjectData = {};
        this.taskTemplates = {};
        this.taskCounter = 0;
        this.currentConfig = {};
        
        this.initializeEventListeners();
        this.initializeTooltips();
        this.setDefaultDateTime();
        this.initializeCronInterpreter();
    }
    
    // === MÉTODOS PARA EDITOR JSON DINÁMICO ===
    
    showObjectModal(objectName = null) {
        this.currentEditingObject = objectName;
        
        if (objectName && this.jsonObjects[objectName]) {
            // Editando objeto existente
            document.getElementById('jsonModalTitle').textContent = `Editar Objeto: ${objectName}`;
            document.getElementById('objectName').value = objectName;
            document.getElementById('objectName').disabled = true;
            this.currentObjectData = JSON.parse(JSON.stringify(this.jsonObjects[objectName]));
        } else {
            // Creando objeto nuevo
            document.getElementById('jsonModalTitle').textContent = 'Crear Nuevo Objeto';
            document.getElementById('objectName').value = '';
            document.getElementById('objectName').disabled = false;
            this.currentObjectData = {};
        }
        
        this.renderPropertiesList();
        this.updateObjectPreview();
        this.resetPropertyForm();
        
        const modal = new bootstrap.Modal(document.getElementById('jsonObjectModal'));
        modal.show();
    }
    
    updatePropertyInput(type) {
        const container = document.getElementById('propertyValueContainer');
        let inputHtml = '';
        
        switch (type) {
            case 'string':
                inputHtml = '<input type="text" class="form-control" id="propertyValue" placeholder="valor de texto">';
                break;
            case 'number':
                inputHtml = '<input type="number" class="form-control" id="propertyValue" placeholder="123">';
                break;
            case 'boolean':
                inputHtml = `
                    <select class="form-select" id="propertyValue">
                        <option value="true">true</option>
                        <option value="false">false</option>
                    </select>
                `;
                break;
            case 'array':
                inputHtml = '<input type="text" class="form-control" id="propertyValue" placeholder="elemento1, elemento2, elemento3">';
                break;
            case 'object':
                inputHtml = `
                    <textarea class="form-control" id="propertyValue" rows="3" 
                              placeholder='{"clave": "valor"}'></textarea>
                `;
                break;
            case 'null':
                inputHtml = '<input type="text" class="form-control" id="propertyValue" value="null" readonly>';
                break;
        }
        
        container.innerHTML = inputHtml;
    }
    
    addProperty() {
        const key = document.getElementById('propertyKey').value.trim();
        const type = document.getElementById('propertyType').value;
        const valueInput = document.getElementById('propertyValue');
        
        if (!key) {
            this.showAlert('La clave de la propiedad no puede estar vacía', 'warning');
            return;
        }
        
        let value;
        try {
            switch (type) {
                case 'string':
                    value = valueInput.value;
                    break;
                case 'number':
                    value = parseFloat(valueInput.value) || 0;
                    break;
                case 'boolean':
                    value = valueInput.value === 'true';
                    break;
                case 'array':
                    value = valueInput.value.split(',').map(item => item.trim()).filter(item => item);
                    break;
                case 'object':
                    value = valueInput.value.trim() ? JSON.parse(valueInput.value) : {};
                    break;
                case 'null':
                    value = null;
                    break;
                default:
                    value = valueInput.value;
            }
        } catch (error) {
            this.showAlert('Error parseando el valor: ' + error.message, 'danger');
            return;
        }
        
        this.currentObjectData[key] = value;
        this.renderPropertiesList();
        this.updateObjectPreview();
        this.resetPropertyForm();
        
        this.showAlert(`Propiedad "${key}" agregada`, 'success');
    }
    
    removeProperty(key) {
        if (confirm(`¿Eliminar la propiedad "${key}"?`)) {
            delete this.currentObjectData[key];
            this.renderPropertiesList();
            this.updateObjectPreview();
            this.showAlert(`Propiedad "${key}" eliminada`, 'info');
        }
    }
    
    editProperty(key, value) {
        this.currentEditingProperty = key;
        document.getElementById('complexPropertyJson').value = JSON.stringify(value, null, 2);
        
        const modal = new bootstrap.Modal(document.getElementById('complexPropertyModal'));
        modal.show();
    }
    
    saveComplexProperty() {
        try {
            const jsonText = document.getElementById('complexPropertyJson').value;
            const value = JSON.parse(jsonText);
            
            this.currentObjectData[this.currentEditingProperty] = value;
            this.renderPropertiesList();
            this.updateObjectPreview();
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('complexPropertyModal'));
            modal.hide();
            
            this.showAlert('Propiedad actualizada', 'success');
        } catch (error) {
            this.showAlert('JSON inválido: ' + error.message, 'danger');
        }
    }
    
    renderPropertiesList() {
        const container = document.getElementById('propertiesList');
        
        if (Object.keys(this.currentObjectData).length === 0) {
            container.innerHTML = `
                <div class="text-muted text-center py-3">
                    <i class="fas fa-list"></i>
                    <br>No hay propiedades
                </div>
            `;
            return;
        }
        
        let html = '';
        Object.entries(this.currentObjectData).forEach(([key, value]) => {
            const valueType = Array.isArray(value) ? 'array' : typeof value;
            const valuePreview = this.getValuePreview(value);
            
            html += `
                <div class="property-item p-2 mb-2 border rounded">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <strong>${key}</strong> 
                            <span class="badge bg-secondary ms-1">${valueType}</span>
                            <div class="small text-muted mt-1">${valuePreview}</div>
                        </div>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-sm" onclick="dagGenerator.editProperty('${key}', ${JSON.stringify(value).replace(/"/g, '&quot;')})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="dagGenerator.removeProperty('${key}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    getValuePreview(value) {
        if (value === null) return 'null';
        if (typeof value === 'string') return `"${value.length > 30 ? value.substring(0, 30) + '...' : value}"`;
        if (typeof value === 'number' || typeof value === 'boolean') return value.toString();
        if (Array.isArray(value)) return `[${value.length} elementos]`;
        if (typeof value === 'object') return `{${Object.keys(value).length} propiedades}`;
        return JSON.stringify(value);
    }
    
    updateObjectPreview() {
        const objectName = document.getElementById('objectName').value.trim() || 'objeto_ejemplo';
        const preview = { [objectName]: this.currentObjectData };
        
        document.getElementById('objectPreview').textContent = JSON.stringify(preview, null, 2);
    }
    
    resetPropertyForm() {
        document.getElementById('propertyKey').value = '';
        document.getElementById('propertyType').value = 'string';
        this.updatePropertyInput('string');
    }
    
    toggleImportJson() {
        const textarea = document.getElementById('importJsonTextarea');
        const button = document.getElementById('processImportBtn');
        
        if (textarea.style.display === 'none') {
            textarea.style.display = 'block';
            button.style.display = 'block';
            document.getElementById('importJsonBtn').innerHTML = '<i class="fas fa-times"></i> Cancelar';
        } else {
            textarea.style.display = 'none';
            button.style.display = 'none';
            textarea.value = '';
            document.getElementById('importJsonBtn').innerHTML = '<i class="fas fa-file-import"></i> Importar JSON';
        }
    }
    
    processImportedJson() {
        try {
            const jsonText = document.getElementById('importJsonTextarea').value.trim();
            const imported = JSON.parse(jsonText);
            
            // Merge con los datos existentes
            this.currentObjectData = { ...this.currentObjectData, ...imported };
            
            this.renderPropertiesList();
            this.updateObjectPreview();
            this.toggleImportJson();
            
            this.showAlert('JSON importado exitosamente', 'success');
        } catch (error) {
            this.showAlert('Error importando JSON: ' + error.message, 'danger');
        }
    }
    
    saveJsonObject() {
        const objectName = document.getElementById('objectName').value.trim();
        
        if (!objectName) {
            this.showAlert('El nombre del objeto no puede estar vacío', 'warning');
            return;
        }
        
        // Validar que el nombre sea válido para JSON
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(objectName)) {
            this.showAlert('El nombre del objeto debe ser un identificador válido (solo letras, números y _)', 'warning');
            return;
        }
        
        this.jsonObjects[objectName] = JSON.parse(JSON.stringify(this.currentObjectData));
        
        this.renderJsonObjects();
        this.updatePreview();
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('jsonObjectModal'));
        modal.hide();
        
        const action = this.currentEditingObject ? 'actualizado' : 'creado';
        this.showAlert(`Objeto "${objectName}" ${action} exitosamente`, 'success');
        
        this.currentEditingObject = null;
        this.currentObjectData = {};
    }
    
    renderJsonObjects() {
        const container = document.getElementById('jsonObjectsContainer');
        const emptyMessage = document.getElementById('emptyJsonMessage');
        
        if (Object.keys(this.jsonObjects).length === 0) {
            emptyMessage.style.display = 'block';
            return;
        }
        
        emptyMessage.style.display = 'none';
        
        let html = '';
        Object.entries(this.jsonObjects).forEach(([objectName, objectData]) => {
            const propertiesCount = Object.keys(objectData).length;
            const preview = JSON.stringify(objectData, null, 2);
            
            html += `
                <div class="json-object-card p-3 mb-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="mb-0">
                            <i class="fas fa-cube text-primary"></i>
                            ${objectName}
                        </h6>
                        <div>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="dagGenerator.showObjectModal('${objectName}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="dagGenerator.removeJsonObject('${objectName}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <p class="mb-2 text-muted">
                        <strong>Propiedades:</strong> ${propertiesCount}
                    </p>
                    <details class="mt-2">
                        <summary class="text-primary" style="cursor: pointer;">Ver JSON</summary>
                        <pre class="json-preview p-2 mt-2" style="max-height: 200px;">${preview}</pre>
                    </details>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    removeJsonObject(objectName) {
        if (confirm(`¿Estás seguro de que quieres eliminar el objeto "${objectName}"?`)) {
            delete this.jsonObjects[objectName];
            this.renderJsonObjects();
            this.updatePreview();
            this.showAlert(`Objeto "${objectName}" eliminado`, 'info');
        }
    }
    
    initializeCronInterpreter() {
        // Crear el contenedor para la interpretación del cron
        const cronContainer = document.getElementById('schedule_interval').parentNode;
        
        // Crear el elemento de interpretación
        const interpretationDiv = document.createElement('div');
        interpretationDiv.id = 'cronInterpretation';
        interpretationDiv.className = 'cron-interpretation mt-2 p-3 bg-light border rounded';
        interpretationDiv.innerHTML = '<i class="fas fa-info-circle text-muted"></i> <span class="text-muted">Escribe una expresión cron para ver su interpretación</span>';
        
        cronContainer.insertBefore(interpretationDiv, document.getElementById('cronValidation'));
    }
    
    interpretCron(cronExpression) {
        const interpretationDiv = document.getElementById('cronInterpretation');
        
        if (!cronExpression.trim()) {
            interpretationDiv.innerHTML = '<i class="fas fa-info-circle text-muted"></i> <span class="text-muted">Escribe una expresión cron para ver su interpretación</span>';
            interpretationDiv.className = 'cron-interpretation mt-2 p-3 bg-light border rounded';
            return;
        }
        
        const parts = cronExpression.trim().split(/\s+/);
        
        if (parts.length !== 5) {
            interpretationDiv.innerHTML = '<i class="fas fa-exclamation-triangle text-warning"></i> <span class="text-warning">Formato incorrecto. Debe tener 5 partes: minuto hora día mes día_semana</span>';
            interpretationDiv.className = 'cron-interpretation mt-2 p-3 bg-warning bg-opacity-10 border border-warning rounded';
            return;
        }
        
        const [minute, hour, day, month, dayOfWeek] = parts;
        
        try {
            const interpretation = this.generateCronInterpretation(minute, hour, day, month, dayOfWeek);
            interpretationDiv.innerHTML = `<i class="fas fa-clock text-primary"></i> <span class="text-dark"><strong>Se ejecutará:</strong> ${interpretation}</span>`;
            interpretationDiv.className = 'cron-interpretation mt-2 p-3 bg-primary bg-opacity-10 border border-primary rounded';
        } catch (error) {
            interpretationDiv.innerHTML = `<i class="fas fa-exclamation-triangle text-danger"></i> <span class="text-danger">Error interpretando expresión: ${error.message}</span>`;
            interpretationDiv.className = 'cron-interpretation mt-2 p-3 bg-danger bg-opacity-10 border border-danger rounded';
        }
    }
    
    generateCronInterpretation(minute, hour, day, month, dayOfWeek) {
        let interpretation = "";
        
        // Interpretar frecuencia base
        const frequency = this.determineCronFrequency(minute, hour, day, month, dayOfWeek);
        
        // Generar descripción según la frecuencia
        switch (frequency.type) {
            case 'minute':
                interpretation = this.interpretMinuteSchedule(minute, hour, day, month, dayOfWeek);
                break;
            case 'hourly':
                interpretation = this.interpretHourlySchedule(minute, hour, day, month, dayOfWeek);
                break;
            case 'daily':
                interpretation = this.interpretDailySchedule(minute, hour, day, month, dayOfWeek);
                break;
            case 'weekly':
                interpretation = this.interpretWeeklySchedule(minute, hour, day, month, dayOfWeek);
                break;
            case 'monthly':
                interpretation = this.interpretMonthlySchedule(minute, hour, day, month, dayOfWeek);
                break;
            case 'yearly':
                interpretation = this.interpretYearlySchedule(minute, hour, day, month, dayOfWeek);
                break;
            default:
                interpretation = this.interpretComplexSchedule(minute, hour, day, month, dayOfWeek);
        }
        
        return interpretation;
    }
    
    determineCronFrequency(minute, hour, day, month, dayOfWeek) {
        // Determinar el tipo de frecuencia basado en los valores
        if (minute !== '*' && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
            return { type: 'hourly' };
        } else if (hour !== '*' && day === '*' && month === '*' && dayOfWeek === '*') {
            return { type: 'daily' };
        } else if (dayOfWeek !== '*' && day === '*') {
            return { type: 'weekly' };
        } else if (day !== '*' && dayOfWeek === '*' && month === '*') {
            return { type: 'monthly' };
        } else if (month !== '*') {
            return { type: 'yearly' };
        } else if (minute.includes('/') && hour === '*') {
            return { type: 'minute' };
        } else {
            return { type: 'complex' };
        }
    }
    
    interpretMinuteSchedule(minute, hour, day, month, dayOfWeek) {
        if (minute.includes('/')) {
            const interval = minute.split('/')[1];
            return `cada ${interval} minutos`;
        }
        return `en el minuto ${minute} de cada hora`;
    }
    
    interpretHourlySchedule(minute, hour, day, month, dayOfWeek) {
        const minuteText = minute === '0' ? 'en punto' : `y ${minute} minutos`;
        
        if (hour.includes('/')) {
            const interval = hour.split('/')[1];
            return `cada ${interval} horas a las ${minuteText}`;
        } else if (hour.includes(',')) {
            const hours = hour.split(',').map(h => this.formatHour(h));
            return `a las ${hours.join(', ')} ${minuteText}`;
        } else if (hour.includes('-')) {
            const [start, end] = hour.split('-');
            return `cada hora desde las ${this.formatHour(start)} hasta las ${this.formatHour(end)} ${minuteText}`;
        } else {
            return `todos los días a las ${this.formatHour(hour)}:${minute.padStart(2, '0')}`;
        }
    }
    
    interpretDailySchedule(minute, hour, day, month, dayOfWeek) {
        const timeText = `a las ${this.formatHour(hour)}:${minute.padStart(2, '0')}`;
        return `todos los días ${timeText}`;
    }
    
    interpretWeeklySchedule(minute, hour, day, month, dayOfWeek) {
        const timeText = `a las ${this.formatHour(hour)}:${minute.padStart(2, '0')}`;
        const daysText = this.interpretDayOfWeek(dayOfWeek);
        return `${daysText} ${timeText}`;
    }
    
    interpretMonthlySchedule(minute, hour, day, month, dayOfWeek) {
        const timeText = `a las ${this.formatHour(hour)}:${minute.padStart(2, '0')}`;
        
        if (day.includes('/')) {
            const interval = day.split('/')[1];
            return `cada ${interval} días ${timeText}`;
        } else if (day.includes(',')) {
            const days = day.split(',').join(', ');
            return `los días ${days} de cada mes ${timeText}`;
        } else if (day.includes('-')) {
            const [start, end] = day.split('-');
            return `del día ${start} al ${end} de cada mes ${timeText}`;
        } else {
            return `el día ${day} de cada mes ${timeText}`;
        }
    }
    
    interpretYearlySchedule(minute, hour, day, month, dayOfWeek) {
        const timeText = `a las ${this.formatHour(hour)}:${minute.padStart(2, '0')}`;
        const monthText = this.interpretMonth(month);
        const dayText = day === '*' ? '' : ` el día ${day}`;
        
        return `${monthText}${dayText} ${timeText}`;
    }
    
    interpretComplexSchedule(minute, hour, day, month, dayOfWeek) {
        let parts = [];
        
        // Minutos
        if (minute !== '*') {
            if (minute.includes('/')) {
                parts.push(`cada ${minute.split('/')[1]} minutos`);
            } else if (minute.includes(',')) {
                parts.push(`en los minutos ${minute}`);
            } else {
                parts.push(`en el minuto ${minute}`);
            }
        }
        
        // Horas
        if (hour !== '*') {
            if (hour.includes('/')) {
                parts.push(`cada ${hour.split('/')[1]} horas`);
            } else if (hour.includes(',')) {
                const hours = hour.split(',').map(h => this.formatHour(h));
                parts.push(`a las ${hours.join(', ')}`);
            } else {
                parts.push(`a las ${this.formatHour(hour)}`);
            }
        }
        
        // Días del mes
        if (day !== '*') {
            if (day.includes('/')) {
                parts.push(`cada ${day.split('/')[1]} días`);
            } else if (day.includes(',')) {
                parts.push(`los días ${day} del mes`);
            } else {
                parts.push(`el día ${day} del mes`);
            }
        }
        
        // Meses
        if (month !== '*') {
            parts.push(this.interpretMonth(month));
        }
        
        // Días de la semana
        if (dayOfWeek !== '*') {
            parts.push(this.interpretDayOfWeek(dayOfWeek));
        }
        
        return parts.join(', ');
    }
    
    formatHour(hour) {
        const h = parseInt(hour);
        if (h === 0) return '12:00 AM (medianoche)';
        if (h === 12) return '12:00 PM (mediodía)';
        if (h < 12) return `${h}:00 AM`;
        return `${h - 12}:00 PM`;
    }
    
    interpretDayOfWeek(dayOfWeek) {
        const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        
        if (dayOfWeek.includes(',')) {
            const selectedDays = dayOfWeek.split(',').map(d => days[parseInt(d)]);
            return `los ${selectedDays.join(', ')}`;
        } else if (dayOfWeek.includes('-')) {
            const [start, end] = dayOfWeek.split('-').map(d => parseInt(d));
            return `desde el ${days[start]} hasta el ${days[end]}`;
        } else if (dayOfWeek.includes('/')) {
            const interval = dayOfWeek.split('/')[1];
            return `cada ${interval} días de la semana`;
        } else {
            return `los ${days[parseInt(dayOfWeek)]}`;
        }
    }
    
    interpretMonth(month) {
        const months = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        
        if (month.includes(',')) {
            const selectedMonths = month.split(',').map(m => months[parseInt(m) - 1]);
            return `en ${selectedMonths.join(', ')}`;
        } else if (month.includes('-')) {
            const [start, end] = month.split('-').map(m => parseInt(m));
            return `desde ${months[start - 1]} hasta ${months[end - 1]}`;
        } else if (month.includes('/')) {
            const interval = month.split('/')[1];
            return `cada ${interval} meses`;
        } else {
            return `en ${months[parseInt(month) - 1]}`;
        }
    }
    
    initializeEventListeners() {
        // Botones principales
        document.getElementById('generateConfigBtn').addEventListener('click', () => this.generateConfiguration());
        document.getElementById('resetFormBtn').addEventListener('click', () => this.resetForm());
        document.getElementById('addObjectBtn').addEventListener('click', () => this.showObjectModal());
        document.getElementById('saveObjectBtn').addEventListener('click', () => this.saveJsonObject());
        
        // JSON Object Modal eventos
        document.getElementById('addPropertyBtn').addEventListener('click', () => this.addProperty());
        document.getElementById('propertyType').addEventListener('change', (e) => this.updatePropertyInput(e.target.value));
        document.getElementById('importJsonBtn').addEventListener('click', () => this.toggleImportJson());
        document.getElementById('processImportBtn').addEventListener('click', () => this.processImportedJson());
        document.getElementById('saveComplexPropertyBtn').addEventListener('click', () => this.saveComplexProperty());
        
        // Auto-actualizar vista previa del objeto
        document.getElementById('objectName').addEventListener('input', () => this.updateObjectPreview());
        
        // Botones de vista previa
        document.getElementById('copyJsonBtn').addEventListener('click', () => this.copyJson());
        document.getElementById('downloadJsonBtn').addEventListener('click', () => this.downloadJson());
        
        // Validación de cron en tiempo real
        document.getElementById('schedule_interval').addEventListener('input', (e) => {
            this.validateCron(e.target.value);
            this.interpretCron(e.target.value);
        });
        
        // Botones de cron rápido
        document.querySelectorAll('.cron-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cronExpression = e.target.dataset.cron;
                document.getElementById('schedule_interval').value = cronExpression;
                this.validateCron(cronExpression);
                this.interpretCron(cronExpression);
            });
        });
        
        // Cambio de tipo de tarea en el modal - NO NECESARIO
        // document.getElementById('task_type').addEventListener('change', (e) => this.loadTaskParameters(e.target.value));
        
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
        
        // Preparar datos para enviar (incluyendo objetos JSON personalizados)
        const payload = {
            dag_config: dagConfig,
            custom_objects: this.jsonObjects  // Cambio de tasks a custom_objects
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
            ...this.jsonObjects  // Agregar todos los objetos JSON personalizados
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
            
            // Limpiar objetos JSON
            this.jsonObjects = {};
            this.renderJsonObjects();
            
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
            