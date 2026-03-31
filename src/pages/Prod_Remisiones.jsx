
import React, { useState, useEffect } from "react";
import { Remision } from "@/api/entitiesChaquetas";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Truck, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

import TarjetaRemision from "../components/remisiones/TarjetaRemision";
import FormularioEditarRemision from "../components/remisiones/FormularioEditarRemision";

export default function Remisiones() {
  const [remisiones, setRemisiones] = useState([]);
  const [filteredRemisiones, setFilteredRemisiones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingRemision, setEditingRemision] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      let filtered = remisiones;
      if (searchTerm) {
        filtered = filtered.filter(r => 
          r.numero_remision.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.tipo_remision.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.subtipo_corte?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.operario_asignado?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setFilteredRemisiones(filtered);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, remisiones]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const remisionesData = await Remision.list("-created_date", 50);
      setRemisiones(remisionesData);
    } catch(error) {
      console.error("Error al cargar las remisiones:", error);
      alert("Hubo un problema al cargar las remisiones. Intenta refrescar la página.");
    }
    setIsLoading(false);
  };

  const generarPDFMasivo = (remisionesAImprimir) => {
    const ventanaPDF = window.open('', '_blank');
    if (!ventanaPDF) {
      alert('No se pudo abrir la ventana para el PDF. Deshabilita el bloqueador de ventanas emergentes.');
      return;
    }

    let htmlMasivo = `
    <html>
    <head>
        <title>Reporte de Remisiones</title>
        <style>
            @page { size: letter; margin: 0.6in; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #1a202c; line-height: 1.4; }
            .remision-container { page-break-after: always; }
            .remision-container:last-child { page-break-after: avoid; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2d3748; padding-bottom: 15px; margin-bottom: 25px; }
            .header h1 { font-size: 28px; margin: 0; }
            .header .meta { text-align: right; font-size: 14px; }
            .header .meta p { margin: 3px 0; }
            .header .meta .label { font-weight: bold; }
            .section { margin-bottom: 30px; }
            .section h3 { font-size: 18px; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
            .info-item { background-color: #f7fafc; padding: 12px; border-radius: 6px; border-left: 4px solid #4299e1; }
            .info-item .label { font-weight: bold; color: #4a5568; font-size: 12px; text-transform: uppercase; }
            .info-item .value { font-size: 16px; margin-top: 4px; }
            .producto-card { background-color: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
            .producto-nombre { font-size: 16px; font-weight: bold; color: #2b6cb0; margin-bottom: 10px; }
            .combinacion { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
            .combinacion:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
            .colores-info, .tallas-info { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
            .color-badge { background-color: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
            .talla-badge { background-color: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .materiales-section table { width: 100%; border-collapse: collapse; background-color: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; overflow: hidden; }
            .materiales-section th { background-color: #f59e0b; color: white; padding: 12px; font-weight: bold; text-align: left; }
            .materiales-section td { padding: 10px 12px; border-bottom: 1px solid #fde68a; }
            .materiales-section tr:last-child td { border-bottom: none; }
            .material-nombre { font-weight: 600; color: #92400e; }
            .material-cantidad { font-weight: bold; text-align: right; color: #92400e; }
            .observaciones-section { background-color: #fef3c7; border: 2px solid #d97706; border-radius: 8px; padding: 15px; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
    </head>
    <body>`;

    remisionesAImprimir.forEach(remision => {
      const totalUnidadesRemision = (remision.productos_asignados || []).reduce((sum, p) => sum + (p.total_unidades || 0), 0);

      htmlMasivo += `<div class="remision-container">`;
      htmlMasivo += `
        <div class="header">
            <h1>Remisión de Producción</h1>
            <div class="meta">
                <p><span class="label">Número:</span> ${remision.numero_remision || 'N/A'}</p>
                <p><span class="label">Tipo:</span> ${(remision.tipo_remision || '').replace(/_/g, ' ')}</p>
                <p><span class="label">Estado:</span> ${(remision.estado || '').replace('_', ' ')}</p>
                <p><span class="label">Fecha:</span> ${format(new Date(), 'dd/MM/yyyy')}</p>
            </div>
        </div>
        <div class="info-grid">
            ${remision.operario_asignado ? `<div class="info-item"><div class="label">Operario Asignado</div><div class="value">${remision.operario_asignado}</div></div>` : ''}
            ${remision.fecha_entrega ? `<div class="info-item"><div class="label">Fecha de Entrega</div><div class="value">${format(new Date(remision.fecha_entrega), 'dd/MM/yyyy')}</div></div>` : ''}
            <div class="info-item"><div class="label">Total de Unidades</div><div class="value">${totalUnidadesRemision}</div></div>
            ${remision.subtipo_corte ? `<div class="info-item"><div class="label">Material de Corte</div><div class="value">${remision.subtipo_corte}</div></div>` : ''}
        </div>
      `;

      if (remision.productos_asignados && remision.productos_asignados.length > 0) {
        htmlMasivo += `<div class="section productos-section"><h3>👕 Productos Asignados</h3>`;
        remision.productos_asignados.forEach(producto => {
            htmlMasivo += `<div class="producto-card"><div class="producto-nombre">${producto.producto_nombre || 'Producto sin nombre'}</div>`;
            (producto.combinaciones || []).forEach(comb => {
                htmlMasivo += `<div class="combinacion">`;
                if (comb.colores_nombres && Object.keys(comb.colores_nombres).length > 0) {
                    htmlMasivo += `<div class="colores-info">${Object.entries(comb.colores_nombres).map(([seccion, color]) => color && color !== 'N/A' ? `<span class="color-badge">${seccion}: ${color}</span>` : '').join('')}</div>`;
                }
                if (comb.tallas_cantidades && comb.tallas_cantidades.length > 0) {
                    htmlMasivo += `<div class="tallas-info">${comb.tallas_cantidades.map(tc => `<span class="talla-badge">Talla ${tc.talla || 'N/A'}: ${tc.cantidad || 0}</span>`).join('')}</div>`;
                }
                htmlMasivo += `</div>`;
            });
            if (producto.observaciones && producto.observaciones.length > 0) {
                htmlMasivo += `<div style="margin-top: 10px; font-style: italic; color: #4a5568;"><strong>Observaciones:</strong> ${producto.observaciones.join(', ')}</div>`;
            }
            htmlMasivo += `</div>`;
        });
        htmlMasivo += `</div>`;
      }
      
      if ((remision.materiales_calculados && remision.materiales_calculados.length > 0) || (remision.detalles_corte && remision.detalles_corte.length > 0)) {
        htmlMasivo += `<div class="section materiales-section"><h3>🧵 Materiales / Detalles de Corte</h3><table><thead><tr><th>Material/Color</th><th>Cantidad</th><th>Unidad</th><th>Observaciones</th></tr></thead><tbody>`;
        (remision.materiales_calculados || []).forEach(mat => {
            htmlMasivo += `<tr><td class="material-nombre">${mat.nombre} (${mat.color || 'N/A'})</td><td class="material-cantidad">${mat.cantidad_total || 0}</td><td>${mat.unidad_medida || 'unidad'}</td><td>${mat.observaciones || ''}</td></tr>`;
        });
        (remision.detalles_corte || []).forEach(det => {
            htmlMasivo += `<tr><td class="material-nombre">${det.color}</td><td class="material-cantidad">${det.cantidad_total || 0}</td><td>${det.unidad_medida || 'unidad'}</td><td>${(det.observaciones || []).join(', ')}</td></tr>`;
        });
        htmlMasivo += `</tbody></table></div>`;
      }

      if (remision.observaciones) {
        htmlMasivo += `<div class="section observaciones-section"><h4>📝 Observaciones Generales</h4><p>${remision.observaciones}</p></div>`;
      }

      htmlMasivo += `<div class="footer"><p><strong>ChaquetasPro</strong> - Documento generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p></div>`;
      htmlMasivo += `</div>`; // Cierre de .remision-container
    });

    htmlMasivo += `
    </body>
    </html>`;

    ventanaPDF.document.write(htmlMasivo);
    ventanaPDF.document.close();
    
    setTimeout(() => {
      ventanaPDF.print();
    }, 500);
  };

  const handleEdit = (remision) => {
    setEditingRemision(remision);
    setShowEditForm(true);
  };

  const handleUpdateRemision = async (updatedData) => {
    try {
      await Remision.update(editingRemision.id, updatedData);
      setShowEditForm(false);
      setEditingRemision(null);
      loadData();
      alert("Remisión actualizada exitosamente");
    } catch (error) {
      console.error("Error al actualizar la remisión:", error);
      alert("Hubo un error al actualizar la remisión");
    }
  };

  const handleDelete = async (remisionId) => {
    if (window.confirm("¿Estás seguro de eliminar esta remisión?")) {
      try {
        await Remision.delete(remisionId);
        loadData();
      } catch (error) {
        console.error('Error al eliminar la remisión', error);
        alert('Error al eliminar la remisión');
      }
    }
  };

  return (
    <div className="p-3 sm:p-8 space-y-4 sm:space-y-8 bg-transparent">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Remisiones de Producción</h1>
            <p className="text-slate-600 text-lg">Gestiona las órdenes de manufactura y producción</p>
          </div>
          <Button 
            onClick={() => generarPDFMasivo(filteredRemisiones)}
            disabled={filteredRemisiones.length === 0}
            variant="outline"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Todas ({filteredRemisiones.length})
          </Button>
        </div>

        {/* Search */}
        <Card className="bg-white border-slate-200 mb-8">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar por número, tipo, material de corte u operario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-slate-200 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Modal Editar */}
        {showEditForm && editingRemision && (
          <FormularioEditarRemision
            remision={editingRemision}
            onSubmit={handleUpdateRemision}
            onCancel={() => {
              setShowEditForm(false);
              setEditingRemision(null);
            }}
          />
        )}
        
        {/* Remisiones Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i} className="bg-white animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredRemisiones.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Truck className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No se encontraron remisiones
              </h3>
              <p className="text-slate-500 mb-6">
                {searchTerm
                  ? "Intenta ajustar tu búsqueda" 
                  : "Crea remisiones desde el planificador de presupuestos aprobados."}
              </p>
            </div>
          ) : (
            filteredRemisiones.map((remision) => (
              <TarjetaRemision
                key={remision.id}
                remision={remision}
                onEdit={() => handleEdit(remision)}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
