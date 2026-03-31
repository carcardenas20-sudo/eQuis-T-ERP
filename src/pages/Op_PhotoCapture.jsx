import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Camera, Upload, CheckCircle, AlertCircle, Loader, Trash2 } from "lucide-react";

export default function PhotoCapture() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleImageSelect = (file) => {
    if (!file) return;
    
    setImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
    setError(null);
    setResult(null);
  };

  const processImage = async () => {
    if (!image) {
      setError("Por favor selecciona una imagen");
      return;
    }

    setLoading(true);
    setError(null);
    setExtractedData(null);

    try {
      // Load employees and products first
      const [empData, prodData] = await Promise.all([
        base44.entities.Employee.list(),
        base44.entities.Producto.list()
      ]);
      setEmployees(empData);
      setProducts((prodData || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })));

      // Upload image to get URL
      const uploadedFile = await base44.integrations.Core.UploadFile({
        file: image
      });

      // Process image with AI
      const analysisResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Analiza esta imagen que contiene registros de despachos y/o entregas de operarios. 
        Extrae la siguiente información en formato JSON:
        {
          "entries": [
            {
              "operario_id": "ID del operario si está visible",
              "operario_name": "Nombre del operario",
              "tipo": "despacho o entrega",
              "product_reference": "Referencia del producto",
              "product_name": "Nombre del producto",
              "quantity": "Cantidad numérica",
              "amount": "Monto en dinero si aplica",
              "date": "Fecha si está visible en formato YYYY-MM-DD"
            }
          ],
          "notes": "Notas adicionales sobre lo que se identificó"
        }
        
        Si no puedes identificar claramente algún campo, déjalo en blanco o null.
        Sé preciso y extrae TODOS los registros visibles en la imagen.`,
        file_urls: [uploadedFile.file_url],
        response_json_schema: {
          type: "object",
          properties: {
            entries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  operario_id: { type: "string" },
                  operario_name: { type: "string" },
                  tipo: { type: "string" },
                  product_reference: { type: "string" },
                  product_name: { type: "string" },
                  quantity: { type: "number" },
                  amount: { type: "number" },
                  date: { type: "string" }
                }
              }
            },
            notes: { type: "string" }
          }
        }
      });

      // Show extracted data for review
      if (analysisResult.entries && analysisResult.entries.length > 0) {
        setExtractedData({
          entries: analysisResult.entries.map((e, idx) => ({ ...e, _id: idx })),
          notes: analysisResult.notes
        });
      } else {
        setError("No se pudieron identificar registros en la imagen");
      }
    } catch (err) {
      console.error("Error procesando imagen:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateExtractedData = (id, field, value) => {
    setExtractedData(prev => ({
      ...prev,
      entries: prev.entries.map(e => 
        e._id === id ? { ...e, [field]: value } : e
      )
    }));
  };

  const removeEntry = (id) => {
    setExtractedData(prev => ({
      ...prev,
      entries: prev.entries.filter(e => e._id !== id)
    }));
  };

  const saveToSystem = async () => {
    if (!extractedData?.entries.length) return;

    setSaving(true);
    setError(null);

    try {
      let updated = 0;
      let failed = 0;

      for (const entry of extractedData.entries) {
        try {
          // Find employee by ID or name
          let employee = employees.find(e => e.employee_id === entry.operario_id);
          if (!employee && entry.operario_name) {
            employee = employees.find(e => e.name.toLowerCase().includes(entry.operario_name.toLowerCase()));
          }

          if (!employee) {
            failed++;
            continue;
          }

          // Find product by reference or name
          let product = products.find(p => p.reference === entry.product_reference);
          if (!product && entry.product_name) {
            product = products.find(p => p.name.toLowerCase().includes(entry.product_name.toLowerCase()));
          }

          const date = entry.date || new Date().toISOString().split('T')[0];

          if (entry.tipo?.toLowerCase() === 'despacho') {
            await base44.entities.Dispatch.create({
              employee_id: employee.employee_id,
              product_reference: product?.reference || entry.product_reference,
              quantity: entry.quantity || 0,
              dispatch_date: date,
              status: 'despachado'
            });
            updated++;
          } else if (entry.tipo?.toLowerCase() === 'entrega') {
            await base44.entities.Delivery.create({
              employee_id: employee.employee_id,
              delivery_date: date,
              items: product ? [{
                product_reference: product.reference,
                quantity: entry.quantity || 0,
                unit_price: product.manufacturing_price || 0,
                total_amount: (entry.quantity || 0) * (product.manufacturing_price || 0)
              }] : [],
              total_amount: entry.amount || (entry.quantity || 0) * (product?.manufacturing_price || 0)
            });
            updated++;
          }
        } catch (entryError) {
          console.error("Error procesando entrada:", entryError);
          failed++;
        }
      }

      setResult({
        success: updated > 0,
        updated,
        failed
      });
      setExtractedData(null);
    } catch (err) {
      setError(`Error guardando: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Camera className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            Captura de Despachos y Entregas
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">Toma una foto o sube una imagen con registros de despachos/entregas para procesarla automáticamente</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">1. Selecciona Imagen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={() => cameraInputRef.current?.click()}
                variant="outline"
                className="flex items-center justify-center gap-2 h-12 text-sm sm:text-base"
              >
                <Camera className="w-4 h-4" />
                Tomar Foto
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex items-center justify-center gap-2 h-12 text-sm sm:text-base"
              >
                <Upload className="w-4 h-4" />
                Subir Imagen
              </Button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleImageSelect(e.target.files?.[0])}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageSelect(e.target.files?.[0])}
              className="hidden"
            />

            {preview && (
              <div className="mt-4">
                <p className="text-xs sm:text-sm font-medium text-slate-700 mb-2">Vista previa:</p>
                <img src={preview} alt="Preview" className="w-full rounded-lg max-h-64 object-cover" />
              </div>
            )}
          </CardContent>
        </Card>

        {preview && !extractedData && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">2. Procesar Imagen</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={processImage}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base font-bold flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Analizando imagen...
                  </>
                ) : (
                  "Analizar Imagen"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {extractedData && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">3. Revisar y Confirmar Datos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {extractedData.notes && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">{extractedData.notes}</AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto">
                <Table className="text-xs sm:text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operario</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="w-10">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedData.entries.map(entry => (
                      <TableRow key={entry._id}>
                        <TableCell>
                          <Select value={entry.operario_id || ""} onValueChange={(val) => updateExtractedData(entry._id, 'operario_id', val)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {employees.map(emp => (
                                <SelectItem key={emp.employee_id} value={emp.employee_id}>
                                  {emp.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={entry.tipo || ""} onValueChange={(val) => updateExtractedData(entry._id, 'tipo', val)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="despacho">Despacho</SelectItem>
                              <SelectItem value="entrega">Entrega</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={entry.product_reference || ""} onValueChange={(val) => {
                            const prod = products.find(p => p.reference === val);
                            updateExtractedData(entry._id, 'product_reference', val);
                            if (prod) updateExtractedData(entry._id, 'product_name', prod.name);
                          }}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Producto" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(prod => (
                                <SelectItem key={prod.reference} value={prod.reference}>
                                  {prod.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={entry.quantity || ""}
                            onChange={(e) => updateExtractedData(entry._id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs text-right w-20"
                            step="0.1"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={entry.date || ""}
                            onChange={(e) => updateExtractedData(entry._id, 'date', e.target.value)}
                            className="h-8 text-xs w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEntry(entry._id)}
                            className="p-0 h-8 w-8 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => setExtractedData(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={saveToSystem}
                  disabled={saving}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Confirmar y Guardar"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert className="mb-6 bg-red-50 border-red-200 text-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Card className={`border-2 ${result.success ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                Datos Guardados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base">
              <div className="flex justify-between">
                <span className="text-slate-700">Registros guardados:</span>
                <span className="font-bold text-green-700">{result.updated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Errores:</span>
                <span className={`font-bold ${result.failed > 0 ? 'text-red-700' : 'text-green-700'}`}>{result.failed}</span>
              </div>
              <Button
                onClick={() => {
                  setImage(null);
                  setPreview(null);
                  setResult(null);
                }}
                variant="outline"
                className="w-full mt-4"
              >
                Procesar Otra Imagen
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}