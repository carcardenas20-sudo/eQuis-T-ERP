
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Package, Edit, Trash2, LayoutGrid, Download, Printer } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const getStatusColor = (estado) => {
  const colors = {
    pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    en_proceso: 'bg-blue-100 text-blue-700 border-blue-200',
    completado: 'bg-green-100 text-green-700 border-green-200',
    pausado: 'bg-orange-100 text-orange-700 border-orange-200'
  };
  return colors[estado] || colors.pendiente;
};

function TarjetaRemision({ remision, onEdit, onDelete }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(remision.id);
  };

  const totalUnidadesRemision = (remision.productos_asignados || []).reduce((sum, p) => sum + (p.total_unidades || 0), 0);

  const generarPDF = (paraImprimir = false) => {
    const ventanaPDF = window.open('', '_blank');
    if (!ventanaPDF) {
      alert('No se pudo abrir la ventana para el PDF. Deshabilita el bloqueador de ventanas emergentes.');
      return;
    }

    let htmlContent = `
<html>
<head>
    <title>Remisión ${remision.numero_remision || 'Sin Número'}</title>
    <style>
        @page {
            size: letter;
            margin: 0.6in;
        }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0;
            padding: 0; 
            font-size: 14px;
            color: #1a202c;
            line-height: 1.4;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #2d3748;
            padding-bottom: 15px;
            margin-bottom: 25px;
        }
        .header h1 {
            font-size: 28px;
            color: #1a202c;
            margin: 0;
        }
        .header .meta {
            text-align: right;
            font-size: 14px;
        }
        .header .meta p {
            margin: 3px 0;
        }
        .header .meta .label {
            font-weight: bold;
        }
        
        .section {
            margin-bottom: 30px;
        }
        .section h3 {
            font-size: 18px;
            color: #2d3748;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 8px;
            margin-bottom: 15px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 25px;
        }
        .info-item {
            background-color: #f7fafc;
            padding: 12px;
            border-radius: 6px;
            border-left: 4px solid #4299e1;
        }
        .info-item .label {
            font-weight: bold;
            color: #4a5568;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .info-item .value {
            font-size: 16px;
            color: #1a202c;
            margin-top: 4px;
        }
        
        .productos-section {
            margin-bottom: 25px;
        }
        .producto-card {
            background-color: #f8fafc;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
        }
        .producto-nombre {
            font-size: 16px;
            font-weight: bold;
            color: #2b6cb0;
            margin-bottom: 10px;
        }
        .combinacion {
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        .combinacion:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        .colores-info {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 8px;
        }
        .color-badge {
            background-color: #dbeafe;
            color: #1e40af;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        .tallas-info {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .talla-badge {
            background-color: #dcfce7;
            color: #166534;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .materiales-section table {
            width: 100%;
            border-collapse: collapse;
            background-color: #fffbeb;
            border: 2px solid #f59e0b;
            border-radius: 8px;
            overflow: hidden;
        }
        .materiales-section th {
            background-color: #f59e0b;
            color: white;
            padding: 12px;
            font-weight: bold;
            text-align: left;
        }
        .materiales-section td {
            padding: 10px 12px;
            border-bottom: 1px solid #fde68a;
        }
        .materiales-section tr:last-child td {
            border-bottom: none;
        }
        .material-nombre {
            font-weight: 600;
            color: #92400e;
        }
        .material-cantidad {
            font-weight: bold;
            text-align: right;
            color: #92400e;
        }
        
        .observaciones-section {
            background-color: #fef3c7;
            border: 2px solid #d97706;
            border-radius: 8px;
            padding: 15px;
        }
        .observaciones-section h4 {
            color: #92400e;
            margin-top: 0;
            margin-bottom: 10px;
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #718096;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
        }
        
        @media print {
            body { -webkit-print-color-adjust: exact; }
        }
    </style>
</head>
<body>
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
        ${remision.operario_asignado ? `
        <div class="info-item">
            <div class="label">Operario Asignado</div>
            <div class="value">${remision.operario_asignado}</div>
        </div>
        ` : ''}
        
        ${remision.fecha_entrega ? `
        <div class="info-item">
            <div class="label">Fecha de Entrega</div>
            <div class="value">${format(new Date(remision.fecha_entrega), 'dd/MM/yyyy')}</div>
        </div>
        ` : ''}
        
        <div class="info-item">
            <div class="label">Total de Unidades</div>
            <div class="value">${totalUnidadesRemision}</div>
        </div>
        
        ${remision.subtipo_corte ? `
        <div class="info-item">
            <div class="label">Material de Corte</div>
            <div class="value">${remision.subtipo_corte}</div>
        </div>
        ` : ''}
    </div>`;

    // Productos asignados
    if (remision.productos_asignados && Array.isArray(remision.productos_asignados) && remision.productos_asignados.length > 0) {
      htmlContent += `
    <div class="section productos-section">
        <h3>👕 Productos Asignados</h3>`;
      
      remision.productos_asignados.forEach(producto => {
        htmlContent += `
        <div class="producto-card">
            <div class="producto-nombre">${producto.producto_nombre || 'Producto sin nombre'}</div>`;
        
        if (producto.combinaciones && Array.isArray(producto.combinaciones)) {
          producto.combinaciones.forEach((comb) => {
            htmlContent += `<div class="combinacion">`;
            
            // Colores
            if (comb.colores_nombres && typeof comb.colores_nombres === 'object' && Object.keys(comb.colores_nombres).length > 0) {
              htmlContent += `<div class="colores-info">`;
              Object.entries(comb.colores_nombres).forEach(([seccion, color]) => {
                if (color && color !== 'N/A') {
                  htmlContent += `<span class="color-badge">${seccion}: ${color}</span>`;
                }
              });
              htmlContent += `</div>`;
            }
            
            // Tallas
            if (comb.tallas_cantidades && Array.isArray(comb.tallas_cantidades) && comb.tallas_cantidades.length > 0) {
              htmlContent += `<div class="tallas-info">`;
              comb.tallas_cantidades.forEach(tc => {
                htmlContent += `<span class="talla-badge">Talla ${tc.talla || 'N/A'}: ${tc.cantidad || 0}</span>`;
              });
              htmlContent += `</div>`;
            }
            
            htmlContent += `</div>`;
          });
        }
        
        // Observaciones del producto
        if (producto.observaciones && Array.isArray(producto.observaciones) && producto.observaciones.length > 0) {
          htmlContent += `<div style="margin-top: 10px; font-style: italic; color: #4a5568;">
            <strong>Observaciones:</strong> ${producto.observaciones.join(', ')}
          </div>`;
        }
        
        htmlContent += `</div>`;
      });
      
      htmlContent += `</div>`;
    }

    // Materiales
    if (remision.materiales_calculados && Array.isArray(remision.materiales_calculados) && remision.materiales_calculados.length > 0) {
      htmlContent += `
    <div class="section materiales-section">
        <h3>🧵 Materiales Requeridos</h3>
        <table>
            <thead>
                <tr>
                    <th>Material</th>
                    <th>Color</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Observaciones</th>
                </tr>
            </thead>
            <tbody>`;
      
      remision.materiales_calculados.forEach(material => {
        htmlContent += `
                <tr>
                    <td class="material-nombre">${material.nombre || ''}</td>
                    <td>${material.color || 'N/A'}</td>
                    <td class="material-cantidad">${material.cantidad_total || 0}</td>
                    <td>${material.unidad_medida || 'unidad'}</td>
                    <td>${material.observaciones || ''}</td>
                </tr>`;
      });
      
      htmlContent += `
            </tbody>
        </table>
    </div>`;
    }

    // Detalles de corte
    if (remision.detalles_corte && Array.isArray(remision.detalles_corte) && remision.detalles_corte.length > 0) {
      htmlContent += `
    <div class="section materiales-section">
        <h3>✂️ Detalles de Corte</h3>
        <table>
            <thead>
                <tr>
                    <th>Color</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Observaciones</th>
                </tr>
            </thead>
            <tbody>`;
      
      remision.detalles_corte.forEach(detalle => {
        htmlContent += `
                <tr>
                    <td class="material-nombre">${detalle.color || ''}</td>
                    <td class="material-cantidad">${detalle.cantidad_total || 0}</td>
                    <td>${detalle.unidad_medida || 'unidad'}</td>
                    <td>${detalle.observaciones || ''}</td>
                </tr>`;
      });
      
      htmlContent += `
            </tbody>
        </table>
    </div>`;
    }

    // Observaciones generales
    if (remision.observaciones) {
      htmlContent += `
    <div class="section observaciones-section">
        <h4>📝 Observaciones Generales</h4>
        <p>${remision.observaciones}</p>
    </div>`;
    }

    htmlContent += `
    <div class="footer">
        <p><strong>ChaquetasPro - Sistema de Gestión de Producción</strong></p>
        <p>Documento generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
    </div>
</body>
</html>`;

    ventanaPDF.document.write(htmlContent);
    ventanaPDF.document.close();
    
    if (paraImprimir) {
      setTimeout(() => {
        ventanaPDF.print();
      }, 500);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, shadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-white border-slate-200 hover:border-teal-300 transition-all duration-200 h-full group flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base font-bold text-slate-900 mb-2 leading-tight">
                {remision.numero_remision}
              </CardTitle>
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge className={`${getStatusColor(remision.estado)} border font-medium`}>
                  {remision.estado?.replace('_', ' ')}
                </Badge>
                <Badge variant="outline" className="border-slate-300 text-slate-600">
                  {remision.tipo_remision.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Link to={createPageUrl(`PlanificacionRemisiones?remision=${remision.id}`)}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-blue-50 hover:text-blue-600 transition-colors h-8 w-8"
                  title="Editar en planificador"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => generarPDF(false)}
                className="hover:bg-green-50 hover:text-green-600 transition-colors h-8 w-8"
                title="Descargar PDF"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => generarPDF(true)}
                className="hover:bg-purple-50 hover:text-purple-600 transition-colors h-8 w-8"
                title="Imprimir"
              >
                <Printer className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(remision)}
                className="hover:bg-teal-50 hover:text-teal-600 transition-colors h-8 w-8"
                title="Edición rápida"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="hover:bg-red-50 hover:text-red-600 transition-colors h-8 w-8"
                title="Eliminar remisión"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 flex-grow">
          <div className="flex items-center justify-between text-sm">
            {remision.operario_asignado && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">Operario: </span>
                <span className="font-medium text-slate-900">{remision.operario_asignado}</span>
              </div>
            )}
            <Badge variant="secondary" className="font-mono text-xs">
              {totalUnidadesRemision} Unidades
            </Badge>
          </div>

          {remision.fecha_entrega && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">Entrega: </span>
              <span className="font-medium text-slate-900">
                {remision.fecha_entrega ? format(new Date(remision.fecha_entrega), "dd/MM/yyyy") : 'N/A'}
              </span>
            </div>
          )}

          {/* Información de productos - MEJORADA PARA ASIGNACIONES INDIVIDUALES */}
          {(remision.productos_asignados && remision.productos_asignados.length > 0) && (
            <div className="border-t border-slate-100 pt-3 space-y-3">
              {remision.productos_asignados.slice(0, 3).map((prod, index) => (
                <div key={index} className="bg-slate-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 text-sm">{prod.producto_nombre || 'Producto'}</span>
                  </div>
                  
                  {(prod.combinaciones && Array.isArray(prod.combinaciones)) && prod.combinaciones.map((comb, c_idx) => (
                    <div key={c_idx} className="space-y-1">
                      {comb.colores_nombres && typeof comb.colores_nombres === 'object' && Object.keys(comb.colores_nombres).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(comb.colores_nombres).map(([seccion, color]) => (
                            <Badge key={seccion} variant="outline" className="text-xs border-slate-300">
                              <span className="capitalize text-slate-500">{seccion}:</span>
                              <span className="ml-1 font-medium">{color || 'N/A'}</span>
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {(comb.tallas_cantidades && Array.isArray(comb.tallas_cantidades) && comb.tallas_cantidades.length > 0) && (
                        <div className="flex flex-wrap gap-1">
                          {comb.tallas_cantidades.map((tc, t_idx) => (
                            <Badge key={t_idx} variant="outline" className="text-xs bg-blue-50 border-blue-200">
                              Talla {tc.talla || 'N/A'}: <span className="font-bold ml-1">{tc.cantidad || 0}</span>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {(prod.observaciones && Array.isArray(prod.observaciones) && prod.observaciones.length > 0) && (
                    <div className="text-xs text-slate-600 italic">
                      Obs: {prod.observaciones.join(', ')}
                    </div>
                  )}
                </div>
              ))}
              
              {remision.productos_asignados.length > 3 && (
                <p className="text-xs text-slate-500 text-center">
                  ...y {remision.productos_asignados.length - 3} productos más.
                </p>
              )}
            </div>
          )}

          {/* Información de materiales - MEJORADA */}
          {(remision.materiales_calculados && remision.materiales_calculados.length > 0) && (
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-blue-600"/>
                <span className="font-bold text-slate-800 text-sm">
                  Materiales ({remision.materiales_calculados.length})
                </span>
              </div>
              <div className="space-y-1">
                {remision.materiales_calculados.slice(0, 4).map((detalle, index) => (
                  <div key={index} className="bg-blue-50 rounded px-2 py-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">
                        {detalle.nombre || 'Material Desconocido'} <span className="text-slate-600">({detalle.color || 'N/A'})</span>
                      </span>
                      <span className="font-bold text-blue-700">
                        {detalle.cantidad_total || 0} {detalle.unidad_medida || 'unidad'}
                      </span>
                    </div>
                    {detalle.observaciones && (
                      <div className="text-xs text-slate-600 italic mt-1">
                        {detalle.observaciones}
                      </div>
                    )}
                  </div>
                ))}
                {remision.materiales_calculados.length > 4 && (
                  <p className="text-xs text-slate-500 text-center">
                    ...y {remision.materiales_calculados.length - 4} materiales más.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Observaciones generales */}
          {remision.observaciones && (
            <div className="border-t border-slate-100 pt-3">
              <div className="text-sm text-slate-600 line-clamp-2">
                <span className="font-medium text-slate-700">Observaciones: </span>
                {remision.observaciones}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default React.memo(TarjetaRemision);
