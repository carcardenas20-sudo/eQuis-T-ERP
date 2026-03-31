import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export default function IntegracionAPI() {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const apiUrl = window.location.origin + "/api";

  const codeBlocks = [
    {
      title: "1. Registrar Entrega de Manufactura (Suma Inventario)",
      description: "Cuando un taller entrega chaquetas terminadas",
      code: `// Desde tu app de manufactura
const response = await fetch('${apiUrl}/entities/InventoryMovement', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer TU_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    product_id: "ID_PRODUCTO_POS",  // Ver mapeo abajo
    location_id: "ID_SUCURSAL",      // ID de la sucursal destino
    movement_type: "entry",
    quantity: 50,                     // Cantidad entregada
    reason: "Entrega manufactura - Taller X",
    cost_per_unit: 45000,            // Costo unitario
    movement_date: "2026-02-17"      // Fecha de entrega
  })
});`
    },
    {
      title: "2. Crear Cuenta por Pagar (Salario Taller)",
      description: "Cuando registres un pago pendiente a un taller/operario",
      code: `// Desde tu app de manufactura
const response = await fetch('${apiUrl}/entities/AccountPayable', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer TU_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    supplier_name: "Pepita Suárez",
    type: "manufacturing_salary",
    description: "Salario quincenal - Confección 50 chaquetas",
    category: "salarios_manufactura",
    total_amount: 1000000,
    pending_amount: 1000000,
    due_date: "2026-02-20",
    location_id: "ID_SUCURSAL",
    external_reference: "PAGO_123_APP_MANUFACTURA",  // Tu ID
    notes: "Registrado desde app de manufactura"
  })
});`
    }
  ];

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">🔗 Integración con App de Manufactura</h1>
          <p className="text-slate-600">
            Conecta tu sistema de manufactura con este POS para sincronizar entregas e inventario
          </p>
        </div>

        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-purple-900 text-xl flex items-center gap-2">
              🔑 PRIMER PASO: Generar tu API Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white p-4 rounded-lg border-2 border-purple-300">
              <p className="font-bold text-lg text-purple-900 mb-3">Cómo generar tu API Key en Base44:</p>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold">1</span>
                  <div>
                    <p className="font-semibold">Sal de la vista previa de tu app</p>
                    <p className="text-slate-600">Haz clic en el botón ← "Atrás" o "Volver al editor"</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold">2</span>
                  <div>
                    <p className="font-semibold">En el panel de Base44, busca "Settings" (Configuración)</p>
                    <p className="text-slate-600">Icono de engranaje ⚙️ en el menú lateral izquierdo</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold">3</span>
                  <div>
                    <p className="font-semibold">Haz clic en "API" o "API Keys"</p>
                    <p className="text-slate-600">Debería estar en el menú de configuración</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold">4</span>
                  <div>
                    <p className="font-semibold">Selecciona las entidades a las que quieres dar acceso:</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-slate-700">✓ <code className="bg-purple-100 px-2 py-1 rounded text-xs">InventoryMovement</code> (para entregas)</p>
                      <p className="text-slate-700">✓ <code className="bg-purple-100 px-2 py-1 rounded text-xs">AccountPayable</code> (para pagos)</p>
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold">5</span>
                  <div>
                    <p className="font-semibold">Haz clic en "Generar" o "Create API Key"</p>
                    <p className="text-slate-600">Se generará una llave única (ejemplo: <code className="text-xs bg-slate-100 px-1 rounded">1a094eb7552544b680174bec4e91e6dd</code>)</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold">6</span>
                  <div>
                    <p className="font-semibold">Copia y guarda tu API Key en un lugar seguro</p>
                    <p className="text-slate-600">⚠️ Trátala como una contraseña - no la compartas públicamente</p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="bg-amber-50 p-3 rounded border border-amber-300">
              <p className="text-sm text-amber-900">
                <strong>💡 Consejo:</strong> Una vez tengas tu API Key, reemplaza <code className="bg-amber-100 px-2 py-1 rounded text-xs">TU_API_KEY</code> 
                en los ejemplos de código de abajo con tu llave real.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-800">⚠️ Paso 1: Conseguir tu API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-semibold text-yellow-900">Desde el panel de Base44:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Sal de la vista previa de tu app (botón atrás)</li>
                <li>En el panel lateral izquierdo, haz clic en <strong>"Settings"</strong> o el ícono de engranaje</li>
                <li>Busca la sección <strong>"API"</strong> o <strong>"API Keys"</strong></li>
                <li>Genera credenciales para: <code className="bg-yellow-100 px-2 py-1 rounded">InventoryMovement</code> y <code className="bg-yellow-100 px-2 py-1 rounded">AccountPayable</code></li>
                <li>Copia el <strong>API Key</strong> que te den (guárdalo en un lugar seguro)</li>
              </ol>
            </div>
            
            <div className="border-t border-yellow-300 pt-3">
              <p className="font-semibold text-yellow-900 mb-2">⚠️ Nota de seguridad:</p>
              <p className="text-xs text-yellow-800">Esta API Key es como una contraseña. No la compartas públicamente y guárdala solo en el servidor de tu app de manufactura.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-800">✅ Paso 2: Dónde Pegar el Código en Manufactura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-semibold text-green-900">En tu app de manufactura (la otra), pega el código en:</p>
            
            <div className="space-y-3">
              <div className="bg-white p-3 rounded border border-green-200">
                <p className="font-semibold text-green-800 mb-2">📦 Para Entregas de Inventario:</p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-gray-700">
                  <li>Cuando un operario/taller <strong>marca una entrega como completada</strong></li>
                  <li>En el botón de <strong>"Finalizar Producción"</strong> o <strong>"Entregar"</strong></li>
                  <li>Después de confirmar la cantidad entregada</li>
                  <li>Antes o después de registrar el pago al taller</li>
                </ul>
              </div>

              <div className="bg-white p-3 rounded border border-green-200">
                <p className="font-semibold text-green-800 mb-2">💰 Para Pagos Pendientes:</p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-gray-700">
                  <li>Cuando <strong>registres un salario/pago pendiente</strong> a un operario</li>
                  <li>Al crear un nuevo <strong>"Pago Pendiente"</strong> en manufactura</li>
                  <li>Después de calcular el monto a pagar</li>
                  <li>Esto se reflejará automáticamente aquí en "Cuentas por Pagar"</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-green-300 pt-3">
              <p className="font-semibold text-green-900 mb-2">🔧 Ejemplo práctico:</p>
              <div className="bg-slate-50 p-3 rounded text-xs font-mono space-y-1">
                <p className="text-green-700">// En tu función de manufactura que procesa entregas:</p>
                <p>async function procesarEntregaTaller(entrega) {'{'}</p>
                <p className="ml-4">// ... tu lógica existente ...</p>
                <p className="ml-4 text-blue-600">// PEGA AQUÍ el código de "Registrar Entrega"</p>
                <p className="ml-4">// (reemplaza TU_API_KEY, product_id, etc.)</p>
                <p>{'}'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="entregas" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="entregas">Entregas</TabsTrigger>
            <TabsTrigger value="pagos">Pagos Pendientes</TabsTrigger>
            <TabsTrigger value="mapeo">Mapeo de Productos</TabsTrigger>
          </TabsList>

          <TabsContent value="entregas" className="space-y-4">
            {codeBlocks.slice(0, 1).map((block, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{block.title}</CardTitle>
                  <p className="text-sm text-slate-600">{block.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{block.code}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 text-slate-400 hover:text-slate-100"
                      onClick={() => copyToClipboard(block.code, index)}
                    >
                      {copiedIndex === index ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800">💡 Resultado</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>✅ Se suma automáticamente al inventario de la sucursal</p>
                <p>✅ Se registra el movimiento en el historial</p>
                <p>✅ Se actualiza el stock disponible</p>
                <p>✅ NO crea una "compra" manual</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagos" className="space-y-4">
            {codeBlocks.slice(1, 2).map((block, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{block.title}</CardTitle>
                  <p className="text-sm text-slate-600">{block.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{block.code}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 text-slate-400 hover:text-slate-100"
                      onClick={() => copyToClipboard(block.code, index + 1)}
                    >
                      {copiedIndex === index + 1 ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800">💡 Flujo Completo</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p><strong>1.</strong> En app manufactura → Registras "Pagué 1M a Pepita"</p>
                <p><strong>2.</strong> Automáticamente se crea aquí → Cuenta por Pagar pendiente</p>
                <p><strong>3.</strong> Cuando físicamente pagues → Marcas pago aquí (módulo Cuentas por Pagar)</p>
                <p><strong>4.</strong> Si pagas en efectivo → Se crea Gasto automático y resta del control de caja</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mapeo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>🔀 Mapeo de Referencias: Manufactura → POS</CardTitle>
                <p className="text-sm text-slate-600">
                  Como en manufactura tienes 4 referencias que aquí son 1 sola categoría "hombre"
                </p>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                  <div className="border-b pb-2">
                    <p className="text-sm font-semibold text-slate-700">App de Manufactura → Este POS</p>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="bg-white p-3 rounded border">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Chaqueta Hombre Tipo A</span>
                        <span className="text-slate-400">→</span>
                        <span className="text-blue-600 font-medium">Producto: "Hombre" (SKU: XXX)</span>
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded border">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Chaqueta Hombre Tipo B</span>
                        <span className="text-slate-400">→</span>
                        <span className="text-blue-600 font-medium">Producto: "Hombre" (SKU: XXX)</span>
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded border">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Chaqueta Hombre Tipo C</span>
                        <span className="text-slate-400">→</span>
                        <span className="text-blue-600 font-medium">Producto: "Hombre" (SKU: XXX)</span>
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded border">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Chaqueta Hombre Tipo D</span>
                        <span className="text-slate-400">→</span>
                        <span className="text-blue-600 font-medium">Producto: "Hombre" (SKU: XXX)</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>💡 Solución:</strong> En tu app de manufactura, cuando cualquiera de las 4 referencias se entregue, 
                      usa el mismo <code className="bg-blue-100 px-1 rounded">product_id</code> del producto "Hombre" de este POS.
                      Todas suman al mismo inventario.
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="font-semibold mb-3">📋 Para obtener los product_id correctos:</h3>
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg">
                    <code className="text-sm">
{`// Desde tu app de manufactura, obtén la lista de productos:
const response = await fetch('${apiUrl}/entities/Product', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer TU_API_KEY'
  }
});

const products = await response.json();
// Guarda los IDs que necesites para el mapeo`}
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}