
import React, { useState, useEffect, useCallback } from "react";
import { User } from "@/entities/User";
import { Role } from "@/entities/Role";
import { 
  BookOpen, 
  Star,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  FileText,
  DollarSign
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import TutorialCard from "../components/tutorials/TutorialCard";
import TutorialModal from "../components/tutorials/TutorialModal";

// Tutorial definitions organized by permission categories
const allTutorials = {
  pos_sales: [
    {
      id: 'pos-basic',
      title: 'Realizar tu Primera Venta',
      description: 'Aprende los pasos básicos para procesar una venta en el sistema POS.',
      duration: '5 min',
      difficulty: 'Básico',
      icon: ShoppingCart,
      category: 'Punto de Venta',
      steps: [
        {
          title: 'Acceder al POS',
          content: 'Ve al módulo "Punto de Venta" desde el menú lateral. Aquí procesarás todas las transacciones.',
          tip: 'Asegúrate de tener una sucursal seleccionada antes de comenzar.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Buscar Productos',
          content: 'Utiliza la barra de búsqueda para encontrar productos por nombre, SKU o código de barras.',
          tip: 'Puedes usar * para buscar productos similares.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Agregar al Carrito',
          content: 'Haz clic en el botón "+" del producto deseado para agregarlo al carrito de compras.',
          tip: 'Solo puedes agregar productos que tengan stock disponible.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Revisar el Carrito',
          content: 'En el panel derecho verás los productos agregados, cantidades y el total.',
          tip: 'Puedes ajustar cantidades o aplicar descuentos individuales aquí.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Procesar Pago',
          content: 'Haz clic en "Procesar Pago" y selecciona el método de pago (efectivo, tarjeta, etc.).',
          tip: 'Puedes combinar múltiples métodos de pago en una sola venta.',
          imageUrl: '' // Placeholder for screenshot URL
        }
      ]
    },
    {
      id: 'pos-discounts',
      title: 'Aplicar Descuentos',
      description: 'Aprende a aplicar descuentos individuales y globales en las ventas.',
      duration: '3 min',
      difficulty: 'Básico',
      icon: DollarSign,
      category: 'Punto de Venta',
      steps: [
        {
          title: 'Descuentos por Producto',
          content: 'En el carrito, cada producto tiene un campo de descuento donde puedes aplicar un porcentaje.',
          tip: 'Los descuentos se aplican automáticamente al total del producto.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Descuento Global',
          content: 'Usa el campo "Descuento Global" para aplicar un descuento a toda la venta.',
          tip: 'El descuento global se aplica después de los descuentos individuales.',
          imageUrl: '' // Placeholder for screenshot URL
        }
      ]
    }
  ],

  products_create: [
    {
      id: 'products-create',
      title: 'Crear un Nuevo Producto',
      description: 'Aprende a registrar productos en el catálogo con toda su información.',
      duration: '7 min',
      difficulty: 'Intermedio',
      icon: Package,
      category: 'Productos',
      steps: [
        {
          title: 'Acceder a Productos',
          content: 'Ve al módulo "Productos" desde el menú lateral.',
          tip: 'Aquí administras todo tu catálogo de productos.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Crear Producto',
          content: 'Haz clic en "Nuevo Producto" para abrir el formulario de creación.',
          tip: 'Asegúrate de tener toda la información del producto antes de empezar.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Información Básica',
          content: 'Completa el SKU (único), nombre, descripción y categoría del producto.',
          tip: 'El SKU no puede repetirse, usa un sistema de códigos consistente.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Precios y Costos',
          content: 'Define el costo base y precio de venta. Estos determinan tu margen de ganancia.',
          tip: 'Revisa bien estos valores, afectan directamente tu rentabilidad.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Stock Inicial',
          content: 'Si tienes inventario inicial, agrégalo por sucursal en la sección de inventario.',
          tip: 'Puedes configurar el stock mínimo para recibir alertas.',
          imageUrl: '' // Placeholder for screenshot URL
        }
      ]
    }
  ],

  inventory_adjust: [
    {
      id: 'inventory-adjustment',
      title: 'Ajustar Stock de Productos',
      description: 'Aprende a corregir las cantidades de inventario cuando sea necesario.',
      duration: '4 min',
      difficulty: 'Intermedio',
      icon: Package,
      category: 'Inventario',
      steps: [
        {
          title: 'Acceder al Inventario',
          content: 'Ve al módulo "Inventario" desde el menú lateral.',
          tip: 'Aquí puedes ver el stock actual de todos los productos por ubicación.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Encontrar el Producto',
          content: 'Usa los filtros de búsqueda para encontrar el producto que necesitas ajustar.',
          tip: 'Puedes filtrar por ubicación, producto o nivel de stock.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Realizar Ajuste',
          content: 'Haz clic en "Ajustar" en la fila del producto que quieres modificar.',
          tip: 'Solo haz ajustes cuando hayas verificado físicamente el inventario.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Confirmar Cambios',
          content: 'Ingresa la nueva cantidad y una razón para el ajuste, luego confirma.',
          tip: 'Siempre documenta la razón del ajuste para mantener un historial claro.',
          imageUrl: '' // Placeholder for screenshot URL
        }
      ]
    }
  ],

  purchases_create: [
    {
      id: 'purchases-basic',
      title: 'Crear una Orden de Compra',
      description: 'Aprende a generar órdenes de compra para tus proveedores.',
      duration: '8 min',
      difficulty: 'Intermedio',
      icon: ShoppingCart,
      category: 'Compras',
      steps: [
        {
          title: 'Acceder a Compras',
          content: 'Ve al módulo "Compras" desde el menú lateral.',
          tip: 'Aquí gestionas todas tus órdenes y proveedores.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Nueva Orden de Compra',
          content: 'Haz clic en "Nueva Compra" para crear una orden.',
          tip: 'Asegúrate de tener tus proveedores ya registrados.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Seleccionar Proveedor',
          content: 'Elige el proveedor y la sucursal de destino para la mercancía.',
          tip: 'Verifica que los datos de contacto del proveedor estén actualizados.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Agregar Productos',
          content: 'Selecciona los productos, cantidades y costos unitarios.',
          tip: 'Los costos aquí afectarán tu margen de ganancia.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Revisar y Confirmar',
          content: 'Verifica el total y confirma la orden para enviarla al proveedor.',
          tip: 'Puedes cambiar el estado a "Ordenada" una vez enviada.',
          imageUrl: '' // Placeholder for screenshot URL
        }
      ]
    }
  ],

  reports_basic: [
    {
      id: 'reports-basic',
      title: 'Generar Reportes Básicos',
      description: 'Aprende a usar el sistema de reportes para analizar tu negocio.',
      duration: '6 min',
      difficulty: 'Básico',
      icon: BarChart3,
      category: 'Reportes',
      steps: [
        {
          title: 'Acceder a Reportes',
          content: 'Ve al módulo "Reportes" desde el menú lateral.',
          tip: 'Los reportes te ayudan a entender el desempeño de tu negocio.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Seleccionar Tipo',
          content: 'En el panel izquierdo, selecciona el tipo de reporte que necesitas (ventas, productos, etc.).',
          tip: 'Comienza con "Ventas por Día" para ver la tendencia general.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Configurar Filtros',
          content: 'Ajusta las fechas, ubicación y otros filtros según lo que quieras analizar.',
          tip: 'Los filtros te permiten analizar períodos o segmentos específicos.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Interpretar Datos',
          content: 'Los gráficos y tablas muestran los datos filtrados de manera visual y numérica.',
          tip: 'Presta atención a las tendencias y patrones en los datos.',
          imageUrl: '' // Placeholder for screenshot URL
        }
      ]
    }
  ],

  customers_create: [
    {
      id: 'customers-create',
      title: 'Registrar Clientes Frecuentes',
      description: 'Aprende a crear perfiles de clientes para ventas y créditos.',
      duration: '3 min',
      difficulty: 'Básico',
      icon: Users,
      category: 'Clientes',
      steps: [
        {
          title: 'Acceder a Clientes',
          content: 'Ve al módulo "Clientes" desde el menú lateral.',
          tip: 'Registrar clientes facilita las ventas recurrentes y el manejo de créditos.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Nuevo Cliente',
          content: 'Haz clic en "Nuevo Cliente" para abrir el formulario de registro.',
          tip: 'Solo necesitas información básica para comenzar.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Información Esencial',
          content: 'Completa el nombre y teléfono del cliente. Estos campos son obligatorios.',
          tip: 'Un teléfono válido es importante para contacto y recuperación de créditos.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Información Adicional',
          content: 'Puedes agregar dirección, email y otros datos que consideres útiles.',
          tip: 'Entre más información tengas, mejor podrás atender al cliente.',
          imageUrl: '' // Placeholder for screenshot URL
        }
      ]
    }
  ],

  expenses_create: [
    {
      id: 'expenses-basic',
      title: 'Registrar Gastos del Negocio',
      description: 'Aprende a registrar y categorizar los gastos operativos.',
      duration: '4 min',
      difficulty: 'Básico',
      icon: FileText,
      category: 'Gastos',
      steps: [
        {
          title: 'Acceder a Gastos',
          content: 'Ve al módulo "Gastos" desde el menú lateral.',
          tip: 'El control de gastos es esencial para la rentabilidad.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Registrar Nuevo Gasto',
          content: 'Haz clic en "Registrar Gasto" para abrir el formulario.',
          tip: 'Ten a la mano la factura o recibo del gasto.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Completar Información',
          content: 'Ingresa la descripción, monto, categoría y fecha del gasto.',
          tip: 'Categorizar correctamente facilita el análisis posterior.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Documentar Comprobante',
          content: 'Agrega el número de factura y proveedor cuando sea posible.',
          tip: 'Esta información es útil para auditorías y reportes fiscales.',
          imageUrl: '' // Placeholder for screenshot URL
        }
      ]
    }
  ],

  settings_system: [
    {
      id: 'system-config',
      title: 'Configuración Inicial del Sistema',
      description: 'Aprende a configurar los aspectos básicos del sistema para tu negocio.',
      duration: '10 min',
      difficulty: 'Avanzado',
      icon: Settings,
      category: 'Administración',
      steps: [
        {
          title: 'Información de la Empresa',
          content: 'En Configuración > Sistema, actualiza los datos de tu empresa (nombre, NIT, dirección).',
          tip: 'Esta información aparece en las facturas y reportes.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Configurar Impuestos',
          content: 'Establece la tasa de impuesto por defecto y si los productos incluyen IVA.',
          tip: 'Esto afecta el cálculo automático de impuestos en todas las ventas.',
          imageUrl: '' // Placeholder for screenshot URL
        },
        {
          title: 'Roles y Permisos',
          content: 'Define los roles de usuario y asigna los permisos apropiados a cada empleado.',
          tip: 'Un buen sistema de permisos protege tu información y mejora la seguridad.',
          imageUrl: '' // Placeholder for screenshot URL
        }
      ]
    }
  ]
};

export default function TutorialsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [availableTutorials, setAvailableTutorials] = useState([]);
  const [completedTutorials, setCompletedTutorials] = useState(new Set());
  const [selectedTutorial, setSelectedTutorial] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const filterTutorialsByPermissions = useCallback((permissions) => {
    const userTutorials = [];
    
    permissions.forEach(permission => {
      if (allTutorials[permission]) {
        userTutorials.push(...allTutorials[permission]);
      }
    });

    setAvailableTutorials(userTutorials);
  }, []); // allTutorials is a static global object, so no need to put it in dependencies. setAvailableTutorials is a stable function.

  const loadUserAndTutorials = useCallback(async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);

      // Load user role and permissions
      if (user.role_id) {
        const role = await Role.filter({ id: user.role_id });
        if (role.length > 0) {
          setUserRole(role[0]);
          filterTutorialsByPermissions(role[0].permissions || []);
        }
      } else if (user.role === 'admin') {
        // Legacy admin gets all tutorials
        setUserRole({ name: 'Administrador', permissions: Object.keys(allTutorials) });
        setAvailableTutorials(Object.values(allTutorials).flat());
      }

      // Load completed tutorials from localStorage
      const completed = JSON.parse(localStorage.getItem('completedTutorials') || '[]');
      setCompletedTutorials(new Set(completed));

    } catch (error) {
      console.error("Error loading user data:", error);
    }
    setIsLoading(false);
  }, [filterTutorialsByPermissions]); // filterTutorialsByPermissions is a dependency because it's called inside. State setters are stable.

  useEffect(() => {
    loadUserAndTutorials();
  }, [loadUserAndTutorials]); // loadUserAndTutorials is now memoized, so this dependency is stable.

  const markTutorialComplete = (tutorialId) => {
    const newCompleted = new Set(completedTutorials);
    newCompleted.add(tutorialId);
    setCompletedTutorials(newCompleted);
    localStorage.setItem('completedTutorials', JSON.stringify(Array.from(newCompleted)));
  };

  const getProgressPercentage = () => {
    if (availableTutorials.length === 0) return 0;
    return (completedTutorials.size / availableTutorials.length) * 100;
  };

  const getTutorialsByCategory = () => {
    const categories = {};
    availableTutorials.forEach(tutorial => {
      if (!categories[tutorial.category]) {
        categories[tutorial.category] = [];
      }
      categories[tutorial.category].push(tutorial);
    });
    return categories;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Cargando tutoriales...</p>
        </div>
      </div>
    );
  }

  const tutorialsByCategory = getTutorialsByCategory();
  const progressPercentage = getProgressPercentage();

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Academia JacketMaster</h1>
          <p className="text-slate-600 mb-6">
            Aprende a usar el sistema paso a paso con tutoriales personalizados para tu rol
          </p>
          
          {/* Progress Card */}
          <Card className="max-w-md mx-auto shadow-lg border-0">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-full">
                  <Star className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Tu Progreso</CardTitle>
                  <p className="text-sm text-slate-600">{userRole?.name || 'Usuario'}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Progress value={progressPercentage} className="h-3" />
                <div className="flex justify-between text-sm">
                  <span>{completedTutorials.size} completados</span>
                  <span>{availableTutorials.length} totales</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tutorials by Category */}
        {Object.entries(tutorialsByCategory).map(([category, tutorials]) => (
          <div key={category}>
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              {category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tutorials.map(tutorial => (
                <TutorialCard
                  key={tutorial.id}
                  tutorial={tutorial}
                  isCompleted={completedTutorials.has(tutorial.id)}
                  onStart={() => setSelectedTutorial(tutorial)}
                />
              ))}
            </div>
          </div>
        ))}

        {availableTutorials.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No hay tutoriales disponibles</h3>
            <p className="text-slate-500">
              Contacta al administrador para que te asigne un rol con permisos adecuados.
            </p>
          </div>
        )}

        {/* Tutorial Modal */}
        {selectedTutorial && (
          <TutorialModal
            tutorial={selectedTutorial}
            onClose={() => setSelectedTutorial(null)}
            onComplete={() => {
              markTutorialComplete(selectedTutorial.id);
              setSelectedTutorial(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
