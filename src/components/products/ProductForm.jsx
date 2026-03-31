import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UploadFile } from "@/integrations/Core";
import { ProductPrice, PriceList } from "@/entities/all";
import { Package, Upload, Loader2, AlertCircle, Trash2, PlusCircle, DollarSign } from "lucide-react";
import { MobileSelect } from "@/components/ui/mobile-select";

const CATEGORIES = ["chaquetas_hombre", "chaquetas_mujer", "chaquetas_niños", "accesorios", "materia_prima"];

const defaultProduct = {
  sku: "",
  name: "",
  description: "",
  category: "chaquetas_hombre",
  base_cost: 0,
  sale_price: 0,
  tax_rate: 19,
  image_url: "",
  is_active: true,
  has_variants: false,
  barcode: "",
  minimum_stock: 5,
  variant_attributes: { color: "", size: "", material: "" }
};

export default function ProductForm({ product, onSave, onCancel }) {
  const [formData, setFormData] = useState(product ? { ...defaultProduct, ...product } : defaultProduct);
  const [priceLists, setPriceLists] = useState([]); // State for available price lists
  const [productPrices, setProductPrices] = useState([]); // State for product-specific price rules
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsSaving(true); // Added: Set saving state to true when loading initial data
      try {
        const lists = await PriceList.list();
        setPriceLists(lists);
        if (product && product.sku) { // Ensure product and sku exist before fetching product prices
          const prices = await ProductPrice.filter({ product_sku: product.sku });
          setProductPrices(prices);
        } else {
            setProductPrices([]); // Clear product prices if no product or SKU
        }
      } catch (err) {
        console.error("Error loading price lists or product prices:", err);
        setError("Error al cargar listas de precios o reglas de precio existentes.");
      }
      setIsSaving(false); // Added: Set saving state back to false after loading initial data
    };
    loadInitialData();
  }, [product]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVariantChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      variant_attributes: { ...prev.variant_attributes, [field]: value }
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setError("");
    try {
      const result = await UploadFile({ file });
      handleChange("image_url", result.file_url);
    } catch (err) {
      setError("Error al subir la imagen. Inténtalo de nuevo.");
      console.error(err);
    }
    setIsUploading(false);
  };

  const handleAddPriceRule = () => {
    if (!formData.sku) {
        setError("Para añadir una regla de precio, el producto debe tener un SKU.");
        return;
    }
    setProductPrices([
      ...productPrices,
      {
        id: `new-${Date.now()}`, // Temporary ID for client-side key management
        product_sku: formData.sku,
        price_list_code: priceLists.length > 0 ? priceLists[0].code : '', // Default to first price list
        min_quantity: 1,
        price: formData.sale_price || 0, // Default to product's sale price
      },
    ]);
  };

  const handlePriceRuleChange = (id, field, value) => {
    const updatedPrices = productPrices.map(rule => 
        rule.id === id ? { ...rule, [field]: value } : rule
    );
    setProductPrices(updatedPrices);
  };

  const handleRemovePriceRule = (id) => {
    setProductPrices(productPrices.filter(p => p.id !== id));
  };

  const handleSubmit = async () => {
    if (!formData.sku || !formData.name || !formData.sale_price) {
      setError("SKU, Nombre y Precio Base son obligatorios.");
      return;
    }

    // Basic validation for price rules
    for (const rule of productPrices) {
        if (!rule.price_list_code) {
            setError("Todas las reglas de precio deben tener una Lista de Precios seleccionada.");
            return;
        }
        if (rule.min_quantity <= 0) {
            setError("La cantidad mínima en las reglas de precio debe ser mayor que 0.");
            return;
        }
        if (rule.price <= 0) {
            setError("El precio en las reglas de precio debe ser mayor que 0.");
            return;
        }
    }


    setIsSaving(true);
    setError("");

    const dataToSave = { ...formData };
    // Assuming 'id' is not a property we want to send for update, if it was from product fetch
    // If your product entity has an 'id' property and it's needed for the update, adjust accordingly.
    // For now, based on defaultProduct, sku is the primary identifier.
    // delete dataToSave.id; 

    // This object contains the main product data and the price rules
    const saveData = {
        productData: dataToSave,
        priceRules: productPrices // Changed: sending productPrices array directly
    };

    await onSave(saveData);
    setIsSaving(false);
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl"> {/* Increased max-width */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="w-6 h-6 text-blue-600" />
            {product ? 'Editar Producto' : 'Crear Nuevo Producto'}
          </DialogTitle>
          <DialogDescription>
            Rellena los detalles del producto. Los campos con * son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-1 pr-4 space-y-6"> {/* Increased max-height */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Core Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" value={formData.sku} onChange={e => handleChange('sku', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" value={formData.name} onChange={e => handleChange('name', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" value={formData.description} onChange={e => handleChange('description', e.target.value)} />
          </div>

          {/* Pricing & Category */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base_cost">Costo Base</Label>
              <Input id="base_cost" type="number" value={formData.base_cost} onChange={e => handleChange('base_cost', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale_price">Precio Base (Detal) *</Label> {/* Label changed */}
              <Input id="sale_price" type="number" value={formData.sale_price} onChange={e => handleChange('sale_price', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_rate">Impuesto (%)</Label>
              <Input id="tax_rate" type="number" value={formData.tax_rate} onChange={e => handleChange('tax_rate', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <MobileSelect
                value={formData.category}
                onValueChange={value => handleChange('category', value)}
                placeholder="Seleccionar categoría"
                options={CATEGORIES.map(cat => ({
                  value: cat,
                  label: cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                }))}
              />
            </div>
          </div>
          
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Imagen del Producto</Label>
            <div className="flex items-center gap-4">
              {formData.image_url && (
                <img src={formData.image_url} alt="preview" className="w-20 h-20 rounded-lg object-cover" />
              )}
              <div className="relative flex-1">
                <Input id="image-upload" type="file" className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" onChange={handleImageUpload} accept="image/*" />
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500">
                  {isUploading ? (
                    <div className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</div>
                  ) : (
                    <div className="flex items-center justify-center gap-2"><Upload className="w-4 h-4" /> {formData.image_url ? "Cambiar imagen" : "Seleccionar imagen"}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stock & Barcode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minimum_stock">Stock Mínimo</Label>
              <Input id="minimum_stock" type="number" value={formData.minimum_stock} onChange={e => handleChange('minimum_stock', parseInt(e.target.value, 10) || 0)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Código de Barras</Label>
              <Input id="barcode" value={formData.barcode} onChange={e => handleChange('barcode', e.target.value)} />
            </div>
          </div>

          {/* Advanced Pricing Rules */}
          <div className="p-4 border-l-4 border-green-500 bg-green-50 rounded-r-lg space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-green-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Reglas de Precios Avanzadas
              </h4>
              <Button size="sm" onClick={handleAddPriceRule} disabled={!formData.sku || !priceLists.length} className="select-none">
                <PlusCircle className="w-4 h-4 mr-2 select-none" />
                Añadir Regla
              </Button>
            </div>
            <div className="space-y-3">
              {productPrices.length === 0 && (
                <p className="text-sm text-gray-500">
                    No hay reglas de precio configuradas. Añade una para ofrecer precios especiales por lista o por volumen.
                </p>
              )}
              {productPrices.map((rule) => (
                <div key={rule.id} className="grid grid-cols-[1fr_0.7fr_0.7fr_auto] gap-3 items-end p-3 bg-white rounded-lg border">
                  <div className='space-y-1'>
                    <Label htmlFor={`price_list_code-${rule.id}`} className="text-xs">Lista de Precios</Label>
                    <MobileSelect
                      value={rule.price_list_code}
                      onValueChange={value => handlePriceRuleChange(rule.id, 'price_list_code', value)}
                      placeholder="Lista de precios..."
                      options={priceLists.map(list => ({
                        value: list.code,
                        label: list.name
                      }))}
                      className={priceLists.length === 0 ? "opacity-50 pointer-events-none" : ""}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor={`min_quantity-${rule.id}`} className="text-xs">Desde Cant.</Label>
                    <Input
                      id={`min_quantity-${rule.id}`}
                      type="number"
                      value={rule.min_quantity}
                      onChange={e => handlePriceRuleChange(rule.id, 'min_quantity', parseInt(e.target.value, 10) || 1)}
                      min="1"
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor={`price-${rule.id}`} className="text-xs">Precio</Label>
                    <Input
                      id={`price-${rule.id}`}
                      type="number"
                      value={rule.price}
                      onChange={e => handlePriceRuleChange(rule.id, 'price', parseFloat(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemovePriceRule(rule.id)} className="self-end select-none">
                    <Trash2 className="w-4 h-4 text-red-500 select-none" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Variants & Status */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Switch id="has_variants" checked={formData.has_variants} onCheckedChange={value => handleChange('has_variants', value)} />
              <Label htmlFor="has_variants">Tiene Variantes</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="is_active" checked={formData.is_active} onCheckedChange={value => handleChange('is_active', value)} />
              <Label htmlFor="is_active">Activo para venta</Label>
            </div>
          </div>

          {formData.has_variants && (
            <div className="p-4 border-l-4 border-blue-500 bg-blue-50 rounded-r-lg space-y-4">
              <h4 className="font-semibold text-blue-800">Atributos de Variante</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input id="color" value={formData.variant_attributes.color} onChange={e => handleVariantChange('color', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="size">Talla</Label>
                  <Input id="size" value={formData.variant_attributes.size} onChange={e => handleVariantChange('size', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="material">Material</Label>
                  <Input id="material" value={formData.variant_attributes.material} onChange={e => handleVariantChange('material', e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isUploading || isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isSaving ? 'Guardando...' : 'Guardar Producto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}