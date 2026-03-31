import React, { useState, useEffect } from "react";
import { SystemSettings } from "@/entities/SystemSettings"; // Added import
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Building, 
  Receipt, 
  Percent, 
  Save, 
  AlertCircle, 
  CheckCircle,
  Info,
  Loader2
} from "lucide-react";
import DiscountPinManager from "./DiscountPinManager";

export default function SystemConfiguration() {
  const [settings, setSettings] = useState({
    // Company Information
    company_name: "JacketMaster",
    company_document: "",
    company_address: "",
    company_phone: "",
    company_email: "",
    
    // Tax Settings
    default_tax_rate: 19,
    tax_enabled: true,
    
    // Receipt Settings
    receipt_header: "",
    receipt_footer: "¡Gracias por su compra!",
    print_receipt_automatically: false,
    
    // POS Settings
    allow_negative_inventory: false,
    require_customer_info: false,
    default_price_list: "RETAIL"
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [currentSettingsId, setCurrentSettingsId] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settingsList = await SystemSettings.list();
      if (settingsList.length > 0) {
        const currentSettings = settingsList[0];
        setSettings(currentSettings);
        setCurrentSettingsId(currentSettings.id);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
    setIsLoading(false);
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");
    
    try {
      if (currentSettingsId) {
        // Update existing settings
        await SystemSettings.update(currentSettingsId, settings);
      } else {
        // Create new settings record
        const newSettings = await SystemSettings.create(settings);
        setCurrentSettingsId(newSettings.id);
      }
      
      setSaveMessage("Configuración guardada exitosamente");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveMessage("Error al guardar la configuración");
    }
    
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save Status */}
      {saveMessage && (
        <Alert className={saveMessage.includes("Error") ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
          {saveMessage.includes("Error") ? (
            <AlertCircle className="h-4 w-4 text-red-600" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-600" />
          )}
          <AlertDescription className={saveMessage.includes("Error") ? "text-red-700" : "text-green-700"}>
            {saveMessage}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:gap-5">
        {/* Company Information */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-700 rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-600" />
              Información de la Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-3 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Nombre de la Empresa</Label>
                <Input
                  id="company_name"
                  value={settings.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_document">NIT/Documento</Label>
                <Input
                  id="company_document"
                  placeholder="123456789-1"
                  value={settings.company_document}
                  onChange={(e) => handleChange('company_document', e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company_address">Dirección</Label>
              <Input
                id="company_address"
                placeholder="Dirección de la empresa"
                value={settings.company_address}
                onChange={(e) => handleChange('company_address', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_phone">Teléfono</Label>
                <Input
                  id="company_phone"
                  placeholder="+57 300 123 4567"
                  value={settings.company_phone}
                  onChange={(e) => handleChange('company_phone', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_email">Email</Label>
                <Input
                  id="company_email"
                  type="email"
                  placeholder="info@empresa.com"
                  value={settings.company_email}
                  onChange={(e) => handleChange('company_email', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Configuration */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-700 rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-green-600" />
              Configuración de Impuestos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-3 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-green-50 rounded-lg">
              <div>
                <Label htmlFor="tax_enabled">Habilitar Impuestos</Label>
                <p className="text-sm text-slate-600">Aplicar impuestos a las ventas</p>
              </div>
              <Switch
                id="tax_enabled"
                checked={settings.tax_enabled}
                onCheckedChange={(value) => handleChange('tax_enabled', value)}
              />
            </div>

            {settings.tax_enabled && (
              <div className="space-y-2">
                <Label htmlFor="default_tax_rate">Tasa de Impuesto por Defecto (%)</Label>
                <Input
                  id="default_tax_rate"
                  type="number"
                  min="0"
                  max="100"
                  value={settings.default_tax_rate}
                  onChange={(e) => handleChange('default_tax_rate', parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-slate-500">
                  Esta tasa se aplicará por defecto a todos los productos nuevos
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt Settings */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-700 rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-600" />
              Configuración de Recibos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-3 sm:p-5">
            <div className="space-y-2">
              <Label htmlFor="receipt_header">Encabezado del Recibo</Label>
              <Textarea
                id="receipt_header"
                placeholder="Mensaje que aparece al inicio del recibo"
                value={settings.receipt_header}
                onChange={(e) => handleChange('receipt_header', e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt_footer">Pie del Recibo</Label>
              <Textarea
                id="receipt_footer"
                placeholder="Mensaje de agradecimiento o información adicional"
                value={settings.receipt_footer}
                onChange={(e) => handleChange('receipt_footer', e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-purple-50 rounded-lg">
              <div>
                <Label htmlFor="print_receipt_automatically">Imprimir Recibo Automáticamente</Label>
                <p className="text-sm text-slate-600">Imprimir recibo después de cada venta</p>
              </div>
              <Switch
                id="print_receipt_automatically"
                checked={settings.print_receipt_automatically}
                onCheckedChange={(value) => handleChange('print_receipt_automatically', value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Discount PIN Manager */}
        <DiscountPinManager />

        {/* POS Settings */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-700 rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-orange-600" />
              Configuración del Punto de Venta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-3 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-orange-50 rounded-lg">
              <div>
                <Label htmlFor="allow_negative_inventory">Permitir Inventario Negativo</Label>
                <p className="text-sm text-slate-600">Permitir ventas sin stock disponible</p>
              </div>
              <Switch
                id="allow_negative_inventory"
                checked={settings.allow_negative_inventory}
                onCheckedChange={(value) => handleChange('allow_negative_inventory', value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-blue-50 rounded-lg">
              <div>
                <Label htmlFor="require_customer_info">Requerir Información del Cliente</Label>
                <p className="text-sm text-slate-600">Obligar el ingreso de datos del cliente</p>
              </div>
              <Switch
                id="require_customer_info"
                checked={settings.require_customer_info}
                onCheckedChange={(value) => handleChange('require_customer_info', value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_price_list">Lista de Precios por Defecto</Label>
              <Input
                id="default_price_list"
                placeholder="RETAIL"
                value={settings.default_price_list}
                onChange={(e) => handleChange('default_price_list', e.target.value.toUpperCase())}
              />
              <p className="text-xs text-slate-500">
                Código de la lista de precios que se usará por defecto
              </p>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="shadow-none border border-slate-200 dark:border-slate-700 rounded-lg sm:border-l-4 sm:border-l-blue-500">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Estado del Sistema</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Versión:</span>
                    <Badge variant="outline">v1.0.0</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Última actualización:</span>
                    <Badge variant="outline">{new Date().toLocaleDateString()}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-center sm:justify-end pt-4 sm:pt-6 border-t">
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 gap-2 w-full sm:w-auto h-10 text-sm"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Guardar Configuración
            </>
          )}
        </Button>
      </div>
    </div>
  );
}