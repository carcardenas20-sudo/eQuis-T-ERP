import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, User, Calendar, DollarSign, Trash2, Download, FileSpreadsheet, Copy, LayoutGrid, Users, MoreVertical } from "lucide-react"; // Añadir MoreVertical
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const getStatusColor = (estado) => {
  const colors = {
    borrador: 'bg-slate-100 text-slate-700 border-slate-200',
    enviado: 'bg-blue-100 text-blue-700 border-blue-200',
    aprobado: 'bg-green-100 text-green-700 border-green-200',
    rechazado: 'bg-red-100 text-red-700 border-red-200'
  };
  return colors[estado] || colors.borrador;
};

function TarjetaPresupuesto({ presupuesto, productos, onEdit, onDelete, onCopy, onAsignacionIndividual }) {
  const totalUnidades = presupuesto.productos?.reduce((sum, producto) => {
    const unidadesProducto = (producto.combinaciones || []).reduce((combSum, comb) => {
      const unidadesCombinacion = (comb.tallas_cantidades || []).reduce((tallaSum, talla) => tallaSum + (talla.cantidad || 0), 0);
      return combSum + unidadesCombinacion;
    }, 0);
    return sum + unidadesProducto;
  }, 0) || 0;

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`¿Estás seguro de eliminar el presupuesto "${presupuesto.numero_presupuesto}"?`)) {
      onDelete(presupuesto.id);
    }
  };

  const exportarExcel = () => {
    const numeroPresupuesto = presupuesto.numero_presupuesto;
    const cliente = presupuesto.cliente;
    const fechaEntrega = presupuesto.fecha_entrega ? format(new Date(presupuesto.fecha_entrega), "dd/MM/yyyy") : '';
    const fechaGeneracion = format(new Date(), "dd/MM/yyyy");
    const totalMateriales = (presupuesto.total_materiales || 0).toFixed(2);
    const totalManoObra = (presupuesto.total_mano_obra || 0).toFixed(2);
    const totalGeneral = (presupuesto.total_general || 0).toFixed(2);
    const margenGanancia = presupuesto.margen_ganancia || 0;
    
    // Crear datos CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Encabezado del presupuesto
    csvContent += `Presupuesto;${numeroPresupuesto}\n`;
    csvContent += `Cliente;${cliente}\n`;
    csvContent += `Fecha Entrega;${fechaEntrega}\n`;
    csvContent += `Fecha Generación;${fechaGeneracion}\n`;
    csvContent += `\n`;
    
    // Resumen de costos
    csvContent += `RESUMEN DE COSTOS\n`;
    csvContent += `Concepto;Valor\n`;
    csvContent += `Costo Materiales;$${totalMateriales}\n`;
    
    // Productos
    if (presupuesto.productos && presupuesto.productos.length > 0) {
      csvContent += `PRODUCTOS A FABRICAR\n`;
      csvContent += `Producto;Combinaciones;Total Unidades\n`;
      
      presupuesto.productos.forEach(productoItem => {
        const producto = productos.find(p => p.id === productoItem.producto_id);
        const totalUnidadesProducto = (productoItem.combinaciones || []).reduce((combSum, comb) => {
          const unidadesEnEstaComb = (comb.tallas_cantidades || []).reduce((tallaSum, talla) => tallaSum + (talla.cantidad || 0), 0);
          return combSum + unidadesEnEstaComb;
        }, 0);
        
        csvContent += `${producto?.nombre || 'Producto'};${(productoItem.combinaciones || []).length};${totalUnidadesProducto}\n`;
      });
      csvContent += `\n`;
    }
    
    // Materiales detallados
    if (presupuesto.materiales_calculados && presupuesto.materiales_calculados.length > 0) {
      csvContent += `LISTA DE MATERIALES REQUERIDOS\n`;
      csvContent += `Material;Color;Cantidad;Unidad;Precio Unit.;Costo Total\n`;
      
      presupuesto.materiales_calculados.forEach(material => {
        csvContent += `${material.nombre};${material.color || 'N/A'};${(material.cantidad_total?.toFixed(2) || '0')};${material.unidad_medida || ''};${(material.precio_unitario || 0).toFixed(2)};${(material.costo_total || 0).toFixed(2)}\n`;
      });
      
      csvContent += `TOTAL MATERIALES;;;;;$${totalMateriales}\n`;
    }
    
    csvContent += `\n`;
    csvContent += `Total de unidades a fabricar;${totalUnidades}\n`;
    csvContent += `Sistema ChaquetasPro - Presupuestos\n`;
    
    // Crear y descargar archivo
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Presupuesto_${numeroPresupuesto}_${fechaGeneracion.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generarPDF = () => {
    const ventanaPDF = window.open('', '_blank');
    
    // Crear variables para evitar problemas de template literals
    const numeroPresupuesto = presupuesto.numero_presupuesto;
    const cliente = presupuesto.cliente;
    const fechaEntrega = presupuesto.fecha_entrega ? format(new Date(presupuesto.fecha_entrega), "dd/MM/yyyy") : '';
    const fechaGeneracion = format(new Date(), "dd/MM/yyyy");

    let htmlContent = `
<html>
<head>
    <title>Presupuesto ${numeroPresupuesto}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; font-size: 14px; color: #333; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #eee; padding-bottom: 15px; }
        .header h1 { margin: 0; color: #1a202c; font-size: 28px; }
        .header .meta { text-align: right; }
        .header .meta p { margin: 2px 0; font-size: 13px; }
        .header .meta p span { font-weight: bold; }
        .section { margin-top: 30px; }
        .section h3 { font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 15px; color: #2d3748; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
        th { background-color: #f7fafc; font-weight: 600; }
        tr:nth-child(even) { background-color: #fdfdff; }
        .summary-table td:first-child { font-weight: bold; width: 70%; }
        .summary-table td:last-child { text-align: right; font-weight: bold; font-size: 16px; }
        .total-final { font-size: 20px !important; color: #2c5282; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #718096; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Presupuesto</h1>
        <div class="meta">
            <p><span>Nº Presupuesto:</span> ${numeroPresupuesto}</p>
            <p><span>Cliente:</span> ${cliente}</p>
            <p><span>Fecha Entrega:</span> ${fechaEntrega}</p>
            <p><span>Fecha Generación:</span> ${fechaGeneracion}</p>
        </div>
    </div>

    <div class="section">
        <h3>💰 Resumen de Costos</h3>
        <table class="summary-table">
            <tr><td>Costo Total de Materiales</td><td>$${(presupuesto.total_materiales || 0).toFixed(2)}</td></tr>
            <tr><td class="total-final">PRECIO TOTAL FINAL</td><td class="total-final">$${(presupuesto.total_general || 0).toFixed(2)}</td></tr>
        </table>
    </div>`;

    // Productos
    if (presupuesto.productos && presupuesto.productos.length > 0) {
      htmlContent += `<div class="section">`;
      htmlContent += '<h3>👕 Productos a Fabricar</h3>';
      htmlContent += '<table>';
      htmlContent += '<thead><tr><th>Producto</th><th>Combinaciones</th><th>Total Unidades</th></tr></thead>';
      htmlContent += '<tbody>';
      
      presupuesto.productos.forEach(productoItem => {
        const producto = productos.find(p => p.id === productoItem.producto_id);
        const totalUnidadesPorProducto = (productoItem.combinaciones || []).reduce((combSum, comb) => {
          const unidadesEnEstaComb = (comb.tallas_cantidades || []).reduce((tallaSum, talla) => tallaSum + (talla.cantidad || 0), 0);
          return combSum + unidadesEnEstaComb;
        }, 0);
        
        htmlContent += '<tr>';
        htmlContent += '<td>' + (producto?.nombre || 'Producto') + '</td>';
        htmlContent += '<td>' + (productoItem.combinaciones || []).length + ' combinaciones</td>';
        htmlContent += '<td>' + totalUnidadesPorProducto + '</td>';
        htmlContent += '</tr>';
      });
      
      htmlContent += '</tbody></table>';
      htmlContent += `</div>`;
    }
    
    // Materiales
    if (presupuesto.materiales_calculados && presupuesto.materiales_calculados.length > 0) {
      htmlContent += `<div class="section">`;
      htmlContent += '<h3>🧵 Lista de Materiales Requeridos</h3>';
      htmlContent += '<table>';
      htmlContent += '<thead><tr><th>Material</th><th>Color</th><th>Cantidad</th><th>Unidad</th><th>Precio Unit.</th><th>Costo Total</th></tr></thead>';
      htmlContent += '<tbody>';
      
      presupuesto.materiales_calculados.forEach(material => {
        htmlContent += '<tr>';
        htmlContent += '<td>' + material.nombre + '</td>';
        htmlContent += '<td>' + (material.color || 'N/A') + '</td>';
        htmlContent += '<td>' + (material.cantidad_total?.toFixed(2) || '0') + '</td>';
        htmlContent += '<td>' + (material.unidad_medida || '') + '</td>';
        htmlContent += '<td>$' + (material.precio_unitario || 0).toFixed(2) + '</td>';
        htmlContent += '<td>$' + (material.costo_total || 0).toFixed(2) + '</td>';
        htmlContent += '</tr>';
      });
      
      htmlContent += '<tr class="total-row">';
      htmlContent += '<td colspan="4" style="text-align: right;"><strong>TOTAL MATERIALES</strong></td>';
      htmlContent += '<td colspan="2"><strong>$' + (presupuesto.total_materiales || 0).toFixed(2) + '</strong></td>';
      htmlContent += '</tr>';
      htmlContent += '</tbody></table>';
      htmlContent += `</div>`;
    }
    
    htmlContent += '<div class="footer">';
    htmlContent += '<p><strong>ChaquetasPro - Sistema de Presupuestos</strong></p>';
    htmlContent += '<p>Total de unidades a fabricar: ' + totalUnidades + '</p>';
    htmlContent += '</div>';
    
    htmlContent += '</body></html>';
    
    ventanaPDF.document.write(htmlContent);
    ventanaPDF.document.close();
    
    setTimeout(() => {
      ventanaPDF.print();
    }, 500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, shadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-white border-slate-200 hover:border-green-300 transition-all duration-200 h-full group flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-bold text-slate-900 mb-2">
                {presupuesto.numero_presupuesto}
              </CardTitle>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`${getStatusColor(presupuesto.estado)} border font-medium`}>
                  {presupuesto.estado}
                </Badge>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" title="Más opciones">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCopy(presupuesto)}>
                  <Copy className="w-4 h-4 mr-2" /> Duplicar
                </DropdownMenuItem>

                {presupuesto.estado === 'aprobado' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to={`${createPageUrl('PlanificacionRemisiones')}?presupuesto=${presupuesto.id}`}>
                        <LayoutGrid className="w-4 h-4 mr-2" /> Planificador General
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAsignacionIndividual(presupuesto)}>
                      <Users className="w-4 h-4 mr-2" /> Asignación Individual
                    </DropdownMenuItem>
                  </>
                )}
                
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={exportarExcel}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar a Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={generarPDF}>
                  <Download className="w-4 h-4 mr-2" /> Descargar PDF
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                  <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
          <div>
            {presupuesto.fecha_entrega && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">
                  Entrega: {format(new Date(presupuesto.fecha_entrega), "dd/MM/yyyy")}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <div className="text-sm text-slate-500 font-medium">Total presupuesto</div>
                <div className="text-xl font-bold text-slate-900 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {presupuesto.total_general?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500 font-medium">Unidades</div>
                <div className="text-xl font-bold text-slate-900">{totalUnidades}</div>
              </div>
            </div>
            {/* Falta por comprar */}
            {presupuesto.materiales_calculados && presupuesto.materiales_calculados.length > 0 && (() => {
              const falta = presupuesto.materiales_calculados.reduce((total, m) => {
                // Si está marcado como comprado (flag viejo o cantidad cubre el total) → no suma
                if (m.comprado) return total;
                const comprada = m.cantidad_comprada || 0;
                const totalCant = m.cantidad_total || 0;
                if (comprada >= totalCant && totalCant > 0) return total;
                const fraccion = totalCant > 0 ? Math.max(0, (totalCant - comprada) / totalCant) : 1;
                return total + (m.costo_total || 0) * fraccion;
              }, 0);
              if (falta <= 0) return null;
              return (
                <div className="mt-2 flex items-center justify-between text-xs bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5">
                  <span className="text-orange-700 font-medium">Falta por comprar:</span>
                  <span className="text-orange-800 font-bold">${falta.toFixed(2)}</span>
                </div>
              );
            })()}

            {/* Indicador de materiales comprados */}
            {presupuesto.materiales_calculados && presupuesto.materiales_calculados.length > 0 && (() => {
              const totalMats = presupuesto.materiales_calculados.length;
              const mComprados = presupuesto.materiales_calculados.filter(m =>
                (m.cantidad_comprada !== undefined
                  ? (m.cantidad_comprada || 0) >= (m.cantidad_total || 0) && (m.cantidad_total || 0) > 0
                  : !!m.comprado)
              ).length;
              const todoComprado = mComprados === totalMats;
              const pct = Math.round((mComprados / totalMats) * 100);
              return (
                <div className={`mt-3 rounded-lg px-2.5 py-2 border ${todoComprado ? 'bg-green-50 border-green-200' : mComprados === 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-medium ${todoComprado ? 'text-green-700' : mComprados === 0 ? 'text-red-600' : 'text-orange-700'}`}>
                      {todoComprado ? '✓ Materiales completos' : `${totalMats - mComprados} pendiente${totalMats - mComprados !== 1 ? 's' : ''}`}
                    </span>
                    <span className="text-slate-500">{mComprados}/{totalMats}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${todoComprado ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}

          </div>

          <div className="space-y-3 pt-3 mt-auto">
            {presupuesto.productos && presupuesto.productos.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <div className="text-sm font-medium text-slate-700 mb-2">
                  Productos ({presupuesto.productos.length})
                </div>
                <div className="space-y-1">
                  {(presupuesto.productos || []).slice(0, 2).map((productoItem, index) => {
                    const productoInfo = productos.find(p => p.id === productoItem.producto_id);
                    const totalCombinaciones = (productoItem.combinaciones || []).length;
                    return (
                      <div key={index} className="text-xs text-slate-600 flex justify-between">
                        <span className="truncate">{productoInfo?.nombre || 'Producto'}</span>
                        <span>{totalCombinaciones} combinaciones</span>
                      </div>
                    );
                  })}
                  {presupuesto.productos.length > 2 && (
                    <div className="text-xs text-slate-400">
                      +{presupuesto.productos.length - 2} productos más...
                    </div>
                  )}
                </div>
              </div>
            )}

            {presupuesto.observaciones && (
              <div className="border-t border-slate-100 pt-3">
                <div className="text-sm text-slate-600 line-clamp-2">
                  {presupuesto.observaciones}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default React.memo(TarjetaPresupuesto);