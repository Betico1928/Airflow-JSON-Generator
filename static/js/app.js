class DAGGenerator {
    constructor() {
        this.jsonObjects = {};
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
            document.getElementById('jsonModalTitle').textContent = `Editar Objeto: ${objectName}`;
            document.getElementById('objectName').value = objectName;
            document.getElementById('objectName').disabled = true;
            this.currentObjectData = JSON.parse(JSON.stringify(this.jsonObjects[objectName]));
        } else {
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
            const escapedValue = JSON.stringify(value).replace(/"/g, '&quot;');
            
            html += `
                <div class="property-item p-2 mb-2 border rounded" data-type="${valueType}">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <strong>${key}</strong> 
                            <span class="badge bg-secondary ms-1">${valueType}</span>
                            <div class="small text-muted mt-1">${valuePreview}</div>
                        </div>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-sm" onclick="dagGenerator.editProperty('${key}', ${escapedValue})">
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
        const cronContainer = document.getElementById('schedule_interval').parentNode;
        
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
        
        const frequency = this.determineCronFrequency(minute, hour, day, month, dayOfWeek);
        
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
        
        if (minute !== '*') {
            if (minute.includes('/')) {
                parts.push(`cada ${minute.split('/')[1]} minutos`);
            } else if (minute.includes(',')) {
                parts.push(`en los minutos ${minute}`);
            } else {
                parts.push(`en el minuto ${minute}`);
            }
        }
        
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
        
        if (day !== '*') {
            if (day.includes('/')) {
                parts.push(`cada ${day.split('/')[1]} días`);
            } else if (day.includes(',')) {
                parts.push(`los días ${day} del mes`);
            } else {
                parts.push(`el día ${day} del mes`);
            }
        }
        
        if (month !== '*') {
            parts.push(this.interpretMonth(month));
        }
        
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
        
        document.getElementById('objectName').addEventListener('input', () => this.updateObjectPreview());
        
        document.getElementById('copyJsonBtn').addEventListener('click', () => this.copyJson());
        document.getElementById('downloadJsonBtn').addEventListener('click', () => this.downloadJson());
        
        document.getElementById('schedule_interval').addEventListener('input', (e) => {
            this.validateCron(e.target.value);
            this.interpretCron(e.target.value);
        });
        
        document.querySelectorAll('.cron-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cronExpression = e.target.dataset.cron;
                document.getElementById('schedule_interval').value = cronExpression;
                this.validateCron(cronExpression);
                this.interpretCron(cronExpression);
            });
        });
        
        this.setupAutoPreview();
    }
    
    initializeTooltips() {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
    
    setDefaultDateTime() {
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('start_date').value = localDateTime;
    }
    
    setupAutoPreview() {
        const fieldsToWatch = [
            'dag_id', 'description', 'schedule_interval', 'start_date', 'end_date',
            'tags', 'max_active_runs', 'concurrency', 'max_active_tasks', 'dagrun_timeout',
            'owner', 'catchup', 'depends_on_past', 'email_on_failure', 'email_on_retry', 
            'email_on_success', 'retries', 'retry_delay', 'max_retry_delay', 'execution_timeout',
            'timeout', 'sla', 'retry_exponential_backoff', 'pool', 'pool_slots', 'queue',
            'priority_weight', 'weight_rule', 'trigger_rule', 'default_view', 'orientation',
            'is_paused_upon_creation', 'provide_context', 'render_template_as_native_obj',
            'email', 'on_failure_callback', 'on_success_callback', 'on_retry_callback',
            'sla_miss_callback', 'access_control', 'params', 'doc_md'
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
            
            this.    setCronValidation(isValid ? 'is-valid' : 'is-invalid', message);
        } catch (error) {
            console.error('Error validando cron:', error);
            this.setCronValidation('is-invalid', 'Error validando expresión');
        }
    }
    
    setCronValidation(validationClass, message) {
        const input = document.getElementById('schedule_interval');
        const feedback = document.getElementById('cronValidation');
        
        // Limpiar clases anteriores
        input.classList.remove('is-valid', 'is-invalid');
        feedback.classList.remove('valid-feedback', 'invalid-feedback');
        
        if (validationClass) {
            input.classList.add(validationClass);
            feedback.classList.add(validationClass === 'is-valid' ? 'valid-feedback' : 'invalid-feedback');
            feedback.textContent = message;
        } else {
            feedback.textContent = '';
        }
    }
    
    collectFormData() {
        const formData = {};
        const form = document.getElementById('dagConfigForm');
        const formElements = form.querySelectorAll('input, textarea, select');
        
        formElements.forEach(element => {
            const name = element.name;
            if (!name) return;
            
            let value;
            if (element.type === 'checkbox') {
                value = element.checked;
            } else if (element.type === 'number') {
                value = element.value.trim() !== '' ? parseFloat(element.value) : null;
            } else if (element.type === 'datetime-local') {
                value = element.value ? new Date(element.value).toISOString() : null;
            } else {
                value = element.value.trim() || null;
            }
            
            // No incluir valores null o vacíos excepto para booleanos
            if (value !== null && value !== '' || element.type === 'checkbox') {
                formData[name] = value;
            }
        });
        
        return formData;
    }
    
    async generateConfiguration() {
        try {
            this.showLoading(true);
            
            const dagConfig = this.collectFormData();
            const customObjects = { ...this.jsonObjects };
            
            const response = await fetch('/generate_config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dag_config: dagConfig,
                    custom_objects: customObjects
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentConfig = result.config_object;
                this.updateJsonPreview(result.config);
                this.showAlert('Configuración generada exitosamente!', 'success');
            } else {
                const errors = result.errors || ['Error desconocido'];
                this.showAlert('Errores en la configuración:<br>• ' + errors.join('<br>• '), 'danger');
            }
            
        } catch (error) {
            console.error('Error generando configuración:', error);
            this.showAlert('Error interno del servidor', 'danger');
        } finally {
            this.showLoading(false);
        }
    }
    
    updatePreview() {
        const dagConfig = this.collectFormData();
        const customObjects = { ...this.jsonObjects };
        
        // Crear preview básico
        const previewConfig = {
            dag_id: dagConfig.dag_id || 'mi_dag',
            description: dagConfig.description || '',
            schedule_interval: dagConfig.schedule_interval || null,
            start_date: dagConfig.start_date || null,
            default_args: {
                owner: dagConfig.owner || 'avigna',
                retries: dagConfig.retries || 1,
                retry_delay: dagConfig.retry_delay || 300
            },
            ...customObjects
        };
        
        // Limpiar valores null
        const cleanConfig = this.cleanConfigObject(previewConfig);
        
        this.updateJsonPreview(JSON.stringify(cleanConfig, null, 2));
    }
    
    cleanConfigObject(obj) {
        if (obj === null || obj === undefined) {
            return null;
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.cleanConfigObject(item)).filter(item => item !== null);
        }
        
        if (typeof obj === 'object') {
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
                const cleanedValue = this.cleanConfigObject(value);
                if (cleanedValue !== null && cleanedValue !== '' && 
                    !(Array.isArray(cleanedValue) && cleanedValue.length === 0) &&
                    !(typeof cleanedValue === 'object' && Object.keys(cleanedValue).length === 0)) {
                    cleaned[key] = cleanedValue;
                }
            }
            return cleaned;
        }
        
        return obj;
    }
    
    updateJsonPreview(jsonString) {
        const preview = document.getElementById('jsonPreview');
        preview.textContent = jsonString;
    }
    
    showLoading(show) {
        const btn = document.getElementById('generateConfigBtn');
        if (show) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
            btn.disabled = true;
        } else {
            btn.innerHTML = '<i class="fas fa-cog"></i> Generar Configuración';
            btn.disabled = false;
        }
    }
    
    showAlert(message, type = 'info') {
        // Crear alerta
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
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
    
    copyJson() {
        const jsonText = document.getElementById('jsonPreview').textContent;
        
        if (jsonText.includes('Configura el DAG')) {
            this.showAlert('Primero genera la configuración', 'warning');
            return;
        }
        
        navigator.clipboard.writeText(jsonText).then(() => {
            this.showAlert('JSON copiado al portapapeles!', 'success');
        }).catch(err => {
            console.error('Error copiando:', err);
            this.showAlert('Error copiando al portapapeles', 'danger');
        });
    }
    
    downloadJson() {
        const jsonText = document.getElementById('jsonPreview').textContent;
        
        if (jsonText.includes('Configura el DAG')) {
            this.showAlert('Primero genera la configuración', 'warning');
            return;
        }
        
        const dagId = this.collectFormData().dag_id || 'mi_dag';
        const filename = `${dagId}_config.json`;
        
        const blob = new Blob([jsonText], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        this.showAlert(`Archivo ${filename} descargado!`, 'success');
    }
    
    resetForm() {
        if (confirm('¿Estás seguro de que quieres limpiar todo el formulario? Esta acción no se puede deshacer.')) {
            document.getElementById('dagConfigForm').reset();
            
            // Limpiar objetos JSON personalizados
            this.jsonObjects = {};
            this.renderJsonObjects();
            
            // Restablecer fecha por defecto
            this.setDefaultDateTime();
            
            // Limpiar validación cron
            this.setCronValidation('', '');
            
            // Limpiar interpretación cron
            const interpretationDiv = document.getElementById('cronInterpretation');
            if (interpretationDiv) {
                interpretationDiv.innerHTML = '<i class="fas fa-info-circle text-muted"></i> <span class="text-muted">Escribe una expresión cron para ver su interpretación</span>';
                interpretationDiv.className = 'cron-interpretation mt-2 p-3 bg-light border rounded';
            }
            
            // Limpiar preview
            this.updateJsonPreview(`{
  "message": "Configura el DAG para ver la vista previa"
}`);
            
            this.showAlert('Formulario limpiado', 'info');
        }
    }
}

// Estilos CSS adicionales
const additionalStyles = `
    .json-object-card {
        border: 1px solid #e9ecef;
        border-radius: 8px;
        background-color: #f8f9fa;
    }
    
    .properties-container {
        max-height: 400px;
        overflow-y: auto;
        border: 1px solid #e9ecef;
        border-radius: 4px;
        padding: 10px;
    }
    
    .property-item {
        background-color: #ffffff;
    }
    
    .property-item[data-type="string"] {
        border-left: 4px solid #28a745;
    }
    
    .property-item[data-type="number"] {
        border-left: 4px solid #007bff;
    }
    
    .property-item[data-type="boolean"] {
        border-left: 4px solid #ffc107;
    }
    
    .property-item[data-type="array"] {
        border-left: 4px solid #6f42c1;
    }
    
    .property-item[data-type="object"] {
        border-left: 4px solid #fd7e14;
    }
    
    .cron-interpretation {
        font-size: 0.9em;
        transition: all 0.3s ease;
    }
    
    .cron-interpretation i {
        margin-right: 8px;
    }
    
    .alert {
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .sticky-top {
        top: 20px;
    }
    
    .json-preview {
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 11px;
        line-height: 1.4;
    }
    
    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    .form-control:focus, .form-select:focus {
        border-color: #80bdff;
        box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
    }
    
    .tooltip-icon:hover {
        color: #007bff;
    }
    
    details[open] summary {
        margin-bottom: 10px;
        font-weight: 600;
    }
`;

// Inyectar estilos
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Inicializar aplicación
let dagGenerator;
document.addEventListener('DOMContentLoaded', function() {
    dagGenerator = new DAGGenerator();
});