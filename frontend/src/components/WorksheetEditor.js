import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import TemplateManager from './TemplateManager';

const WorksheetEditor = () => {
  const [config, setConfig] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [activeField, setActiveField] = useState(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [fieldTypes, setFieldTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('editor');
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  useEffect(() => {
    loadWorksheetConfig();
  }, []);

  const loadWorksheetConfig = async () => {
    try {
      // Load from localStorage or default config
      const savedConfig = localStorage.getItem('worksheetConfig');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed.worksheetConfig);
        setFieldTypes(parsed.fieldTypes);
      } else {
        // Load default config
        const response = await fetch('/src/data/worksheetConfig.json');
        const defaultConfig = await response.json();
        setConfig(defaultConfig.worksheetConfig);
        setFieldTypes(defaultConfig.fieldTypes);
      }
      setLoading(false);
    } catch (error) {
      console.error('Hiba a munkalap konfiguráció betöltésekor:', error);
      setLoading(false);
    }
  };

  const saveConfig = () => {
    const fullConfig = {
      version: "1.0",
      worksheetConfig: config,
      fieldTypes: fieldTypes
    };
    localStorage.setItem('worksheetConfig', JSON.stringify(fullConfig));
    alert('Munkalap konfiguráció mentve!');
  };

  const loadTemplate = (templateConfig) => {
    setConfig(templateConfig);
    setActiveTab('editor');
    alert('Sablon betöltve! A konfigurációt most szerkesztheti.');
  };

  const addSection = () => {
    const newSection = {
      id: `section_${Date.now()}`,
      title: "Új szekció",
      icon: "📋",
      fields: []
    };
    setConfig({
      ...config,
      sections: [...config.sections, newSection]
    });
  };

  const addField = (sectionId) => {
    const newField = {
      id: `field_${Date.now()}`,
      label: "Új mező",
      type: "text",
      required: false,
      order: 999,
      width: "full"
    };
    
    const updatedSections = config.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          fields: [...section.fields, newField]
        };
      }
      return section;
    });
    
    setConfig({
      ...config,
      sections: updatedSections
    });
    
    setActiveField(newField);
    setShowFieldEditor(true);
  };

  const editField = (field) => {
    setActiveField(field);
    setShowFieldEditor(true);
  };

  const updateField = (updatedField) => {
    const updatedSections = config.sections.map(section => ({
      ...section,
      fields: section.fields.map(field => 
        field.id === updatedField.id ? updatedField : field
      )
    }));
    
    setConfig({
      ...config,
      sections: updatedSections
    });
    
    setShowFieldEditor(false);
    setActiveField(null);
  };

  const deleteField = (fieldId, sectionId) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a mezőt?')) return;
    
    const updatedSections = config.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          fields: section.fields.filter(field => field.id !== fieldId)
        };
      }
      return section;
    });
    
    setConfig({
      ...config,
      sections: updatedSections
    });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    
    // Handle field reordering within sections
    if (source.droppableId === destination.droppableId) {
      const sectionId = source.droppableId.replace('section-', '');
      const section = config.sections.find(s => s.id === sectionId);
      const reorderedFields = Array.from(section.fields);
      const [moved] = reorderedFields.splice(source.index, 1);
      reorderedFields.splice(destination.index, 0, moved);
      
      // Update order property
      reorderedFields.forEach((field, index) => {
        field.order = index + 1;
      });
      
      const updatedSections = config.sections.map(s => 
        s.id === sectionId ? { ...s, fields: reorderedFields } : s
      );
      
      setConfig({
        ...config,
        sections: updatedSections
      });
    }
  };

  const getFieldTypeIcon = (type) => {
    const fieldType = fieldTypes.find(ft => ft.id === type);
    return fieldType ? fieldType.icon : '📝';
  };

  const getWidthClass = (width) => {
    switch (width) {
      case 'quarter': return 'w-1/4';
      case 'third': return 'w-1/3';
      case 'half': return 'w-1/2';
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">🔧 Munkalap szerkesztő</h3>
          <p className="text-gray-600">Módosítsd a munkalapok mezőit és elrendezését</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab(activeTab === 'templates' ? 'editor' : 'templates')}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 text-sm"
          >
            📚 {activeTab === 'templates' ? 'Szerkesztő' : 'Sablonok'}
          </button>
          <button
            onClick={addSection}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 text-sm"
          >
            ➕ Új szekció
          </button>
          <button
            onClick={saveConfig}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm"
          >
            💾 Mentés
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'templates' && (
        <TemplateManager 
          onLoadTemplate={loadTemplate}
          currentConfig={config}
        />
      )}

      {activeTab === 'editor' && (

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Munkalap címe
            </label>
            <input
              type="text"
              value={config?.title || ''}
              onChange={(e) => setConfig({...config, title: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Work Number Display Settings */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              🔢 Munkalap számozás beállításai
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showWorkNumber"
                  checked={config?.workNumberDisplay?.show || false}
                  onChange={(e) => setConfig({
                    ...config, 
                    workNumberDisplay: {
                      ...config?.workNumberDisplay,
                      show: e.target.checked
                    }
                  })}
                  className="mr-2"
                />
                <label htmlFor="showWorkNumber" className="text-sm font-medium text-gray-700">
                  Munkalap szám megjelenítése
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pozíció
                </label>
                <select
                  value={config?.workNumberDisplay?.position || 'top-left'}
                  onChange={(e) => setConfig({
                    ...config,
                    workNumberDisplay: {
                      ...config?.workNumberDisplay,
                      position: e.target.value
                    }
                  })}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                >
                  <option value="top-left">Bal felső</option>
                  <option value="top-right">Jobb felső</option>
                  <option value="bottom-left">Bal alsó</option>
                  <option value="bottom-right">Jobb alsó</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Formátum
                </label>
                <input
                  type="text"
                  value={config?.workNumberDisplay?.format || 'MUNKA-#{number}'}
                  onChange={(e) => setConfig({
                    ...config,
                    workNumberDisplay: {
                      ...config?.workNumberDisplay,
                      format: e.target.value
                    }
                  })}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  placeholder="Pl: MUNKA-#{number}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  A {'{number}'} helyére kerül a tényleges szám
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Háttérszín
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config?.workNumberDisplay?.backgroundColor || '#3B82F6'}
                    onChange={(e) => setConfig({
                      ...config,
                      workNumberDisplay: {
                        ...config?.workNumberDisplay,
                        backgroundColor: e.target.value
                      }
                    })}
                    className="h-8 w-12 rounded border"
                  />
                  <input
                    type="text"
                    value={config?.workNumberDisplay?.backgroundColor || '#3B82F6'}
                    onChange={(e) => setConfig({
                      ...config,
                      workNumberDisplay: {
                        ...config?.workNumberDisplay,
                        backgroundColor: e.target.value
                      }
                    })}
                    className="flex-1 p-2 border border-gray-300 rounded text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Szövegszín
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config?.workNumberDisplay?.textColor || '#FFFFFF'}
                    onChange={(e) => setConfig({
                      ...config,
                      workNumberDisplay: {
                        ...config?.workNumberDisplay,
                        textColor: e.target.value
                      }
                    })}
                    className="h-8 w-12 rounded border"
                  />
                  <input
                    type="text"
                    value={config?.workNumberDisplay?.textColor || '#FFFFFF'}
                    onChange={(e) => setConfig({
                      ...config,
                      workNumberDisplay: {
                        ...config?.workNumberDisplay,
                        textColor: e.target.value
                      }
                    })}
                    className="flex-1 p-2 border border-gray-300 rounded text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Betűméret (px)
                </label>
                <input
                  type="number"
                  min="10"
                  max="32"
                  value={config?.workNumberDisplay?.fontSize || 16}
                  onChange={(e) => setConfig({
                    ...config,
                    workNumberDisplay: {
                      ...config?.workNumberDisplay,
                      fontSize: e.target.value
                    }
                  })}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>

            {/* Preview */}
            {config?.workNumberDisplay?.show && (
              <div className="mt-4 p-4 bg-white rounded border">
                <p className="text-sm text-gray-600 mb-2">Előnézet:</p>
                <div 
                  className="inline-block"
                  style={{
                    backgroundColor: config.workNumberDisplay.backgroundColor || '#3B82F6',
                    color: config.workNumberDisplay.textColor || '#FFFFFF',
                    fontSize: `${config.workNumberDisplay.fontSize || 16}px`,
                    padding: `${config.workNumberDisplay.padding || 12}px`,
                    borderRadius: `${config.workNumberDisplay.borderRadius || 8}px`,
                    border: `${config.workNumberDisplay.borderWidth || 2}px solid ${config.workNumberDisplay.borderColor || '#1E40AF'}`,
                    fontWeight: 'bold',
                    fontFamily: 'monospace'
                  }}
                >
                  {config.workNumberDisplay.format?.replace('{number}', '43005') || '#43005'}
                </div>
              </div>
            )}
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="space-y-4">
            {config?.sections?.map((section, sectionIndex) => (
              <div key={section.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{section.icon}</span>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => {
                        const updatedSections = config.sections.map(s => 
                          s.id === section.id ? {...s, title: e.target.value} : s
                        );
                        setConfig({...config, sections: updatedSections});
                      }}
                      className="font-semibold text-lg bg-transparent border-none focus:outline-none focus:bg-gray-50 px-2 py-1 rounded"
                    />
                  </div>
                  <button
                    onClick={() => addField(section.id)}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                  >
                    ➕ Mező
                  </button>
                </div>

                <Droppable droppableId={`section-${section.id}`}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2 min-h-[50px] bg-gray-50 rounded p-3"
                    >
                      {section.fields
                        .sort((a, b) => a.order - b.order)
                        .map((field, fieldIndex) => (
                        <Draggable key={field.id} draggableId={field.id} index={fieldIndex}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-3 bg-white rounded border ${
                                snapshot.isDragging ? 'border-blue-400 shadow-lg' : 'border-gray-200'
                              } ${getWidthClass(field.width)} hover:border-gray-300 transition-colors`}
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{getFieldTypeIcon(field.type)}</span>
                                  <div>
                                    <div className="font-medium text-sm">{field.label}</div>
                                    <div className="text-xs text-gray-500">
                                      {field.type} • {field.width} • {field.required ? 'kötelező' : 'opcionális'}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => editField(field)}
                                    className="text-blue-500 hover:text-blue-700 p-1"
                                    title="Szerkesztés"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => deleteField(field.id, section.id)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                    title="Törlés"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {section.fields.length === 0 && (
                        <div className="text-center text-gray-500 py-4">
                          Húzz ide mezőket vagy add hozzá újakat
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>

      )}

      {/* Field Editor Modal */}
      {showFieldEditor && activeField && (
        <FieldEditor
          field={activeField}
          fieldTypes={fieldTypes}
          onSave={updateField}
          onCancel={() => {
            setShowFieldEditor(false);
            setActiveField(null);
          }}
        />
      )}
    </div>
  );
};

// Field Editor Component
const FieldEditor = ({ field, fieldTypes, onSave, onCancel }) => {
  const [editedField, setEditedField] = useState({...field});
  const [activeProperties, setActiveProperties] = useState([]);

  useEffect(() => {
    const fieldType = fieldTypes.find(ft => ft.id === editedField.type);
    setActiveProperties(fieldType?.properties || []);
  }, [editedField.type, fieldTypes]);

  const handleSave = () => {
    onSave(editedField);
  };

  const updateFieldProperty = (property, value) => {
    setEditedField({
      ...editedField,
      [property]: value
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Mező szerkesztése</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Field Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mező típusa
            </label>
            <select
              value={editedField.type}
              onChange={(e) => updateFieldProperty('type', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              {fieldTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic properties based on field type */}
          {activeProperties.includes('label') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mező címkéje
              </label>
              <input
                type="text"
                value={editedField.label}
                onChange={(e) => updateFieldProperty('label', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {activeProperties.includes('required') && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="required"
                checked={editedField.required}
                onChange={(e) => updateFieldProperty('required', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="required" className="text-sm font-medium text-gray-700">
                Kötelező mező
              </label>
            </div>
          )}

          {/* Width setting */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mező szélessége
            </label>
            <select
              value={editedField.width}
              onChange={(e) => updateFieldProperty('width', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="quarter">1/4 szélesség</option>
              <option value="third">1/3 szélesség</option>
              <option value="half">1/2 szélesség</option>
              <option value="full">Teljes szélesség</option>
            </select>
          </div>

          {/* Options for dropdown */}
          {activeProperties.includes('options') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opciók (vesszővel elválasztva)
              </label>
              <input
                type="text"
                value={editedField.options?.join(', ') || ''}
                onChange={(e) => updateFieldProperty('options', e.target.value.split(',').map(s => s.trim()))}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                placeholder="Opció1, Opció2, Opció3"
              />
            </div>
          )}

          {/* Additional properties */}
          {activeProperties.includes('placeholder') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Helyőrző szöveg
              </label>
              <input
                type="text"
                value={editedField.placeholder || ''}
                onChange={(e) => updateFieldProperty('placeholder', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {activeProperties.includes('defaultValue') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alapértelmezett érték
              </label>
              <input
                type={editedField.type === 'number' ? 'number' : 'text'}
                value={editedField.defaultValue || ''}
                onChange={(e) => updateFieldProperty('defaultValue', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Mégsem
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Mentés
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorksheetEditor;