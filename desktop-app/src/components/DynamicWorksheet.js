import React, { useState, useEffect } from 'react';
import carMakesData from '../data/carMakes.json';

const DynamicWorksheet = ({ workOrderId = null, onSave, onCancel }) => {
  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadWorksheetConfig();
    if (workOrderId) {
      loadExistingData();
    }
  }, [workOrderId]);

  const loadWorksheetConfig = () => {
    try {
      const savedConfig = localStorage.getItem('worksheetConfig');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed.worksheetConfig);
      } else {
        // Load default config
        import('../data/worksheetConfig.json').then(defaultConfig => {
          setConfig(defaultConfig.worksheetConfig);
        });
      }
      setLoading(false);
    } catch (error) {
      console.error('Hiba a konfiguráció betöltésekor:', error);
      setLoading(false);
    }
  };

  const loadExistingData = async () => {
    try {
      // Load existing work order data if editing
      const response = await fetch(`/api/work-orders/${workOrderId}`);
      const data = await response.json();
      setFormData(data);
    } catch (error) {
      console.error('Hiba az adatok betöltésekor:', error);
    }
  };

  const handleFieldChange = (fieldId, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
    
    // Clear error when user starts typing
    if (errors[fieldId]) {
      setErrors(prev => ({
        ...prev,
        [fieldId]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    config.sections.forEach(section => {
      section.fields.forEach(field => {
        if (field.required && (!formData[field.id] || formData[field.id].toString().trim() === '')) {
          newErrors[field.id] = `${field.label} kötelező mező`;
        }
      });
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  const renderField = (field) => {
    const commonProps = {
      id: field.id,
      value: formData[field.id] || field.defaultValue || '',
      onChange: (e) => handleFieldChange(field.id, e.target.value),
      className: `w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
        errors[field.id] ? 'border-red-500' : 'border-gray-300'
      }`,
      placeholder: field.placeholder
    };

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            {...commonProps}
            maxLength={field.maxLength}
          />
        );

      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={field.rows || 3}
            maxLength={field.maxLength}
          />
        );

      case 'number':
        return (
          <div className="relative">
            {field.prefix && (
              <span className="absolute left-3 top-3 text-gray-500">{field.prefix}</span>
            )}
            <input
              type="number"
              {...commonProps}
              className={`${commonProps.className} ${field.prefix ? 'pl-8' : ''} ${field.suffix ? 'pr-12' : ''}`}
              min={field.min}
              max={field.max}
              step={field.step || 1}
              onChange={(e) => handleFieldChange(field.id, parseFloat(e.target.value) || 0)}
            />
            {field.suffix && (
              <span className="absolute right-3 top-3 text-gray-500">{field.suffix}</span>
            )}
          </div>
        );

      case 'email':
        return (
          <input
            type="email"
            {...commonProps}
          />
        );

      case 'tel':
        return (
          <input
            type="tel"
            {...commonProps}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            {...commonProps}
            min={field.min}
            max={field.max}
          />
        );

      case 'dropdown':
        return (
          <div>
            <select
              {...commonProps}
              value={formData[field.id] || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
            >
              <option value="">{field.placeholder || 'Válasszon...'}</option>
              {field.options?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
              {/* Load car makes if this is car_make field */}
              {field.id === 'car_make' && carMakesData.map(make => (
                <option key={make.id} value={make.name}>{make.name}</option>
              ))}
            </select>
            {field.allowCustom && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Vagy írjon be egyedi értéket..."
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  onBlur={(e) => {
                    if (e.target.value) {
                      handleFieldChange(field.id, e.target.value);
                    }
                  }}
                />
              </div>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              id={field.id}
              checked={formData[field.id] || false}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              className="mr-2 h-4 w-4 text-blue-600"
            />
            <label htmlFor={field.id} className="text-sm font-medium text-gray-700">
              {field.label}
            </label>
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map(option => (
              <div key={option} className="flex items-center">
                <input
                  type="radio"
                  id={`${field.id}_${option}`}
                  name={field.id}
                  value={option}
                  checked={formData[field.id] === option}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  className="mr-2 h-4 w-4 text-blue-600"
                />
                <label htmlFor={`${field.id}_${option}`} className="text-sm font-medium text-gray-700">
                  {option}
                </label>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            {...commonProps}
          />
        );
    }
  };

  const getWidthClass = (width) => {
    switch (width) {
      case 'quarter': return 'w-full md:w-1/4';
      case 'third': return 'w-full md:w-1/3';
      case 'half': return 'w-full md:w-1/2';
      case 'full': return 'w-full';
      default: return 'w-full';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Betöltés...</span>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500">Hiba a munkalap konfiguráció betöltésekor</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg relative">
        {/* Work Number Display */}
        {config.workNumberDisplay?.show && formData.work_number && (
          <div 
            className={`absolute z-10 ${
              config.workNumberDisplay.position === 'top-left' ? 'top-4 left-4' :
              config.workNumberDisplay.position === 'top-right' ? 'top-4 right-4' :
              config.workNumberDisplay.position === 'bottom-left' ? 'bottom-4 left-4' :
              'bottom-4 right-4'
            }`}
            style={{
              backgroundColor: config.workNumberDisplay.backgroundColor || '#3B82F6',
              color: config.workNumberDisplay.textColor || '#FFFFFF',
              fontSize: `${config.workNumberDisplay.fontSize || 16}px`,
              padding: `${config.workNumberDisplay.padding || 12}px`,
              borderRadius: `${config.workNumberDisplay.borderRadius || 8}px`,
              border: `${config.workNumberDisplay.borderWidth || 2}px solid ${config.workNumberDisplay.borderColor || '#1E40AF'}`,
              fontWeight: 'bold',
              fontFamily: 'monospace',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            {config.workNumberDisplay.format?.replace('{number}', formData.work_number) || `#${formData.work_number}`}
          </div>
        )}
        
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-t-lg">
          <h1 className="text-2xl font-bold">{config.title}</h1>
          <p className="text-blue-100 mt-1">
            {workOrderId ? 'Munkalap szerkesztése' : 'Új munkalap létrehozása'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {config.sections?.map(section => (
            <div key={section.id} className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">{section.icon}</span>
                <h2 className="text-xl font-semibold text-gray-800">{section.title}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {section.fields
                  ?.sort((a, b) => a.order - b.order)
                  .map(field => (
                    <div key={field.id} className={getWidthClass(field.width)}>
                      {field.type !== 'checkbox' && (
                        <label 
                          htmlFor={field.id} 
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                      )}
                      
                      {renderField(field)}
                      
                      {errors[field.id] && (
                        <p className="mt-1 text-sm text-red-500">{errors[field.id]}</p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-6 border-t">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Mégsem
              </button>
            )}
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              💾 {workOrderId ? 'Frissítés' : 'Mentés'}
            </button>
          </div>
        </form>
      </div>

      {/* Print Actions */}
      {workOrderId && (
        <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">🖨️ Nyomtatási opciók</h3>
          <div className="flex gap-4">
            <button
              onClick={() => window.open(`/api/work-orders/${workOrderId}/html`, '_blank')}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
            >
              🌐 HTML nyomtatás
            </button>
            <button
              onClick={() => window.open(`/api/work-orders/${workOrderId}/pdf`, '_blank')}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2"
            >
              📄 PDF letöltés
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicWorksheet;