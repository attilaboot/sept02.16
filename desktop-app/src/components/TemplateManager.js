import React, { useState, useEffect } from 'react';

const TemplateManager = ({ onLoadTemplate, currentConfig }) => {
  const [templates, setTemplates] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [importData, setImportData] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    try {
      const savedTemplates = localStorage.getItem('worksheetTemplates');
      if (savedTemplates) {
        setTemplates(JSON.parse(savedTemplates));
      } else {
        // Load default templates
        const defaultTemplates = getDefaultTemplates();
        setTemplates(defaultTemplates);
        localStorage.setItem('worksheetTemplates', JSON.stringify(defaultTemplates));
      }
    } catch (error) {
      console.error('Hiba a sablonok betöltésekor:', error);
    }
  };

  const getDefaultTemplates = () => {
    return [
      {
        id: 'basic_turbo',
        name: 'Alapvető turbó szerviz',
        description: 'Minimális mezők turbó javításhoz - gyors munkavégzéshez',
        icon: '⚡',
        category: 'basic',
        createdAt: new Date().toISOString(),
        config: {
          title: "Alapvető Turbó Munkalap",
          workNumberDisplay: {
            show: true,
            position: "top-left",
            format: "MUNKA-#{number}",
            backgroundColor: "#10B981",
            textColor: "#FFFFFF",
            fontSize: "14",
            padding: "10",
            borderRadius: "6",
            borderWidth: "2",
            borderColor: "#059669"
          },
          sections: [
            {
              id: "client_basic",
              title: "Ügyfél",
              icon: "👤",
              fields: [
                {
                  id: "client_name",
                  label: "Ügyfél neve",
                  type: "text",
                  required: true,
                  order: 1,
                  width: "half"
                },
                {
                  id: "client_phone",
                  label: "Telefon",
                  type: "tel",
                  required: true,
                  order: 2,
                  width: "half"
                }
              ]
            },
            {
              id: "vehicle_basic",
              title: "Jármű",
              icon: "🚗",
              fields: [
                {
                  id: "car_make",
                  label: "Márka",
                  type: "dropdown",
                  required: true,
                  order: 1,
                  width: "half",
                  options: ["BMW", "Mercedes", "Audi", "VW", "Ford", "Egyéb"],
                  allowCustom: true
                },
                {
                  id: "car_model",
                  label: "Típus",
                  type: "text",
                  required: true,
                  order: 2,
                  width: "half"
                }
              ]
            },
            {
              id: "turbo_basic",
              title: "Turbó",
              icon: "🔧",
              fields: [
                {
                  id: "turbo_code",
                  label: "Turbó kód",
                  type: "text",
                  required: true,
                  order: 1,
                  width: "half"
                },
                {
                  id: "received_date",
                  label: "Dátum",
                  type: "date",
                  required: true,
                  order: 2,
                  width: "half"
                },
                {
                  id: "general_notes",
                  label: "Megjegyzések",
                  type: "textarea",
                  required: false,
                  order: 3,
                  width: "full",
                  rows: 2
                }
              ]
            }
          ]
        }
      },
      {
        id: 'detailed_turbo',
        name: 'Részletes turbó szerviz',
        description: 'Teljes adatgyűjtés minden részlettel - komplex javításokhoz',
        icon: '📋',
        category: 'advanced',
        createdAt: new Date().toISOString(),
        config: {
          title: "Részletes Turbó Munkalap",
          workNumberDisplay: {
            show: true,
            position: "top-left", 
            format: "#{number} - RÉSZLETES",
            backgroundColor: "#3B82F6",
            textColor: "#FFFFFF",
            fontSize: "16",
            padding: "12",
            borderRadius: "8",
            borderWidth: "2",
            borderColor: "#1E40AF"
          },
          sections: [
            {
              id: "client_detailed",
              title: "Ügyfél adatok",
              icon: "👤",
              fields: [
                {
                  id: "client_name",
                  label: "Teljes név",
                  type: "text",
                  required: true,
                  order: 1,
                  width: "half"
                },
                {
                  id: "client_phone",
                  label: "Telefonszám",
                  type: "tel",
                  required: true,
                  order: 2,
                  width: "half"
                },
                {
                  id: "client_email",
                  label: "E-mail cím",
                  type: "email",
                  required: false,
                  order: 3,
                  width: "half"
                },
                {
                  id: "company_name",
                  label: "Cégnév",
                  type: "text",
                  required: false,
                  order: 4,
                  width: "half"
                },
                {
                  id: "client_address",
                  label: "Cím",
                  type: "textarea",
                  required: false,
                  order: 5,
                  width: "full",
                  rows: 2
                }
              ]
            },
            {
              id: "vehicle_detailed",
              title: "Jármű információk",
              icon: "🚗",
              fields: [
                {
                  id: "car_make",
                  label: "Márka",
                  type: "dropdown",
                  required: true,
                  order: 1,
                  width: "quarter",
                  options: ["BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Ford", "Peugeot", "Renault", "Opel"],
                  allowCustom: true
                },
                {
                  id: "car_model",
                  label: "Modell",
                  type: "text",
                  required: true,
                  order: 2,
                  width: "quarter"
                },
                {
                  id: "car_year",
                  label: "Évjárat",
                  type: "number",
                  required: false,
                  order: 3,
                  width: "quarter",
                  min: 1990,
                  max: 2025
                },
                {
                  id: "license_plate",
                  label: "Rendszám",
                  type: "text",
                  required: false,
                  order: 4,
                  width: "quarter"
                },
                {
                  id: "engine_code",
                  label: "Motorkód",
                  type: "text",
                  required: false,
                  order: 5,
                  width: "half"
                },
                {
                  id: "mileage",
                  label: "Km óra",
                  type: "number",
                  required: false,
                  order: 6,
                  width: "half",
                  suffix: "km"
                }
              ]
            },
            {
              id: "turbo_detailed",
              title: "Turbó részletek",
              icon: "🔧",
              fields: [
                {
                  id: "turbo_code",
                  label: "Turbó kód",
                  type: "text",
                  required: true,
                  order: 1,
                  width: "half"
                },
                {
                  id: "received_date",
                  label: "Beérkezés",
                  type: "date",
                  required: true,
                  order: 2,
                  width: "half"
                },
                {
                  id: "problem_description",
                  label: "Hibaleírás",
                  type: "textarea",
                  required: true,
                  order: 3,
                  width: "full",
                  rows: 3
                },
                {
                  id: "symptoms",
                  label: "Tünetek",
                  type: "textarea",
                  required: false,
                  order: 4,
                  width: "full",
                  rows: 2
                },
                {
                  id: "general_notes",
                  label: "További megjegyzések",
                  type: "textarea",
                  required: false,
                  order: 5,
                  width: "full",
                  rows: 2
                }
              ]
            },
            {
              id: "pricing_detailed",
              title: "Árazás",
              icon: "💰",
              fields: [
                {
                  id: "cleaning_price",
                  label: "Tisztítás",
                  type: "number",
                  required: false,
                  order: 1,
                  width: "third",
                  defaultValue: 170,
                  suffix: "LEI"
                },
                {
                  id: "reconditioning_price",
                  label: "Felújítás",
                  type: "number",
                  required: false,
                  order: 2,
                  width: "third",
                  defaultValue: 170,
                  suffix: "LEI"
                },
                {
                  id: "turbo_price",
                  label: "Turbó",
                  type: "number",
                  required: false,
                  order: 3,
                  width: "third",
                  defaultValue: 240,
                  suffix: "LEI"
                }
              ]
            }
          ]
        }
      },
      {
        id: 'quick_diagnosis',
        name: 'Gyors diagnosztika',
        description: 'Gyors ellenőrzéshez szükséges mezők - előzetes vizsgálathoz',
        icon: '🔍',
        category: 'diagnostic',
        createdAt: new Date().toISOString(),
        config: {
          title: "Gyors Diagnosztika Lap",
          workNumberDisplay: {
            show: true,
            position: "top-right",
            format: "DIAG-{number}",
            backgroundColor: "#F59E0B",
            textColor: "#FFFFFF",
            fontSize: "15",
            padding: "10",
            borderRadius: "6",
            borderWidth: "2",
            borderColor: "#D97706"
          },  
          sections: [
            {
              id: "client_quick",
              title: "Ügyfél",
              icon: "👤",
              fields: [
                {
                  id: "client_name",
                  label: "Név",
                  type: "text",
                  required: true,
                  order: 1,
                  width: "half"
                },
                {
                  id: "client_phone",
                  label: "Telefon",
                  type: "tel",
                  required: true,
                  order: 2,
                  width: "half"
                }
              ]
            },
            {
              id: "diagnostic_info",
              title: "Diagnosztika",
              icon: "🔍",
              fields: [
                {
                  id: "turbo_code",
                  label: "Turbó kód",
                  type: "text",
                  required: true,
                  order: 1,
                  width: "half"
                },
                {
                  id: "check_date",
                  label: "Vizsgálat dátuma",
                  type: "date",
                  required: true,
                  order: 2,
                  width: "half"
                },
                {
                  id: "visual_inspection",
                  label: "Szemrevételezés",
                  type: "radio",
                  required: true,
                  order: 3,
                  width: "half",
                  options: ["OK", "Hibás", "Gyanús"]
                },
                {
                  id: "pressure_test",
                  label: "Nyomáspróba",
                  type: "radio",
                  required: false,
                  order: 4,
                  width: "half",
                  options: ["Megfelelő", "Alacsony", "Nincs"]
                },
                {
                  id: "diagnosis_result",
                  label: "Diagnosztika eredménye",
                  type: "dropdown",
                  required: true,
                  order: 5,
                  width: "full",
                  options: [
                    "Javítható",
                    "Cserére szorul", 
                    "További vizsgálat szükséges",
                    "Használható",
                    "Nem javítható"
                  ]
                },
                {
                  id: "recommendations",
                  label: "Javaslatok",
                  type: "textarea",
                  required: false,
                  order: 6,
                  width: "full",
                  rows: 3
                }
              ]
            }
          ]
        }
      }
    ];
  };

  const saveTemplate = () => {
    if (!newTemplateName.trim()) {
      alert('Adja meg a sablon nevét!');
      return;
    }

    const newTemplate = {
      id: `custom_${Date.now()}`,
      name: newTemplateName,
      description: newTemplateDescription,
      icon: '📝',
      category: 'custom',
      createdAt: new Date().toISOString(),
      config: currentConfig
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    localStorage.setItem('worksheetTemplates', JSON.stringify(updatedTemplates));
    
    setShowCreateModal(false);
    setNewTemplateName('');
    setNewTemplateDescription('');
    
    alert('Sablon sikeresen mentve!');
  };

  const deleteTemplate = (templateId) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a sablont?')) return;
    
    const updatedTemplates = templates.filter(t => t.id !== templateId);
    setTemplates(updatedTemplates);
    localStorage.setItem('worksheetTemplates', JSON.stringify(updatedTemplates));
  };

  const exportTemplate = (template) => {
    const exportData = {
      name: template.name,
      description: template.description,
      config: template.config,
      exportedAt: new Date().toISOString(),
      version: "1.0"
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_template.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  const importTemplate = () => {
    try {
      const templateData = JSON.parse(importData);
      
      const newTemplate = {
        id: `imported_${Date.now()}`,
        name: templateData.name || 'Importált sablon',
        description: templateData.description || 'Importálva külső forrásból',
        icon: '📥',
        category: 'imported',
        createdAt: new Date().toISOString(),
        config: templateData.config
      };
      
      const updatedTemplates = [...templates, newTemplate];
      setTemplates(updatedTemplates);
      localStorage.setItem('worksheetTemplates', JSON.stringify(updatedTemplates));
      
      setShowImportModal(false);
      setImportData('');
      alert('Sablon sikeresen importálva!');
    } catch (error) {
      alert('Hibás sablon formátum! Ellenőrizze a JSON struktúrát.');
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'basic': return '⚡';
      case 'advanced': return '📋';
      case 'diagnostic': return '🔍';
      case 'custom': return '📝';
      case 'imported': return '📥';
      default: return '📄';
    }
  };

  const getCategoryName = (category) => {
    switch (category) {
      case 'basic': return 'Alapvető';
      case 'advanced': return 'Részletes';
      case 'diagnostic': return 'Diagnosztika';
      case 'custom': return 'Egyéni';
      case 'imported': return 'Importált';
      default: return 'Egyéb';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">📚 Sablon kezelő</h3>
          <p className="text-gray-600">Mentse el és használja újra munkalap konfigurációit</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm"
          >
            📥 Import
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 text-sm"
          >
            💾 Mentés sablonként
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <div key={template.id} className="bg-white rounded-lg shadow-md border hover:shadow-lg transition-shadow">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <h4 className="font-semibold text-gray-800">{template.name}</h4>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {getCategoryIcon(template.category)} {getCategoryName(template.category)}
                    </span>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
                {template.description}
              </p>
              
              <div className="text-xs text-gray-500 mb-4">
                {template.config.sections?.length || 0} szekció • 
                {template.config.sections?.reduce((total, section) => total + (section.fields?.length || 0), 0) || 0} mező
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => onLoadTemplate(template.config)}
                  className="flex-1 bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600"
                >
                  📋 Betöltés
                </button>
                <button
                  onClick={() => exportTemplate(template)}
                  className="bg-gray-500 text-white px-3 py-2 rounded text-sm hover:bg-gray-600"
                  title="Export"
                >
                  📤
                </button>
                {template.category === 'custom' && (
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="bg-red-500 text-white px-3 py-2 rounded text-sm hover:bg-red-600"
                    title="Törlés"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Új sablon létrehozása</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sablon neve *
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="pl. Saját turbó konfiguráció"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Leírás
                </label>
                <textarea
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Rövid leírás a sablon használatáról..."
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Mégsem
              </button>
              <button
                onClick={saveTemplate}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                💾 Mentés
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Template Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">Sablon importálása</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  JSON sablon adatok
                </label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows="12"
                  placeholder='Illessze be a JSON sablon adatokat itt...'
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Mégsem
              </button>
              <button
                onClick={importTemplate}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                📥 Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManager;