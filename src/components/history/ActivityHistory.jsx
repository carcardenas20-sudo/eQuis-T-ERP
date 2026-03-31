import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Plus, Edit, Trash2, User, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export default function ActivityHistory({ entityType, entityId, filters = {} }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const query = { entity_type: entityType, ...filters };
      if (entityId) {
        query.entity_id = entityId;
      }
      const data = await base44.entities.ActivityLog.filter(query, '-created_date', 100);
      setActivities(data);
    } catch (error) {
      console.error("Error cargando historial:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadActivities();
  }, [entityType, entityId, JSON.stringify(filters)]);

  const getActionIcon = (action) => {
    switch (action) {
      case 'created': return <Plus className="w-4 h-4" />;
      case 'updated': return <Edit className="w-4 h-4" />;
      case 'deleted': return <Trash2 className="w-4 h-4" />;
      default: return <History className="w-4 h-4" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'created': return 'bg-green-100 text-green-800';
      case 'updated': return 'bg-blue-100 text-blue-800';
      case 'deleted': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionText = (action) => {
    switch (action) {
      case 'created': return 'Creado';
      case 'updated': return 'Actualizado';
      case 'deleted': return 'Eliminado';
      default: return action;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-slate-500 mt-2">Cargando historial...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Historial de Actividades
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadActivities}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activities.map((activity) => (
              <div key={activity.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getActionColor(activity.action)}>
                      {getActionIcon(activity.action)}
                      <span className="ml-1">{getActionText(activity.action)}</span>
                    </Badge>
                    {activity.amount && (
                      <Badge variant="outline" className="text-green-700">
                        ${activity.amount.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {format(new Date(activity.created_date), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mb-2">{activity.description}</p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  {activity.employee_name && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {activity.employee_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Por: {activity.created_by}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <History className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No hay actividades registradas.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}