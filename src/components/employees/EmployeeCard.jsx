import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Edit, 
  Phone, 
  Calendar, 
  DollarSign, 
  UserCheck, 
  UserX,
  Briefcase
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function EmployeeCard({ employee, onEdit, onToggleStatus }) {
  return (
    <Card className={`hover:shadow-lg transition-all duration-200 ${
      !employee.is_active ? 'opacity-60' : ''
    }`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 text-lg mb-1">
              {employee.name}
            </h3>
            <p className="text-sm font-medium text-blue-600 mb-2">
              {employee.employee_id}
            </p>
            
            <div className="space-y-2">
              {employee.position && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Briefcase className="w-4 h-4" />
                  {employee.position}
                </div>
              )}
              
              {employee.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="w-4 h-4" />
                  {employee.phone}
                </div>
              )}
              
              {employee.hire_date && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(employee.hire_date), "dd 'de' MMMM, yyyy", { locale: es })}
                </div>
              )}
              
              {employee.salary_per_unit && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <DollarSign className="w-4 h-4" />
                  ${employee.salary_per_unit} por unidad
                </div>
              )}
            </div>
          </div>
          
          <Badge 
            variant={employee.is_active ? "default" : "secondary"}
            className={employee.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
          >
            {employee.is_active ? "Activo" : "Inactivo"}
          </Badge>
        </div>

        <div className="flex gap-2 pt-4 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(employee)}
            className="flex-1"
          >
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
          
          <Button
            variant={employee.is_active ? "destructive" : "default"}
            size="sm"
            onClick={() => onToggleStatus(employee)}
            className={employee.is_active ? "" : "bg-green-600 hover:bg-green-700"}
          >
            {employee.is_active ? (
              <>
                <UserX className="w-4 h-4 mr-2" />
                Inactivar
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4 mr-2" />
                Activar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}