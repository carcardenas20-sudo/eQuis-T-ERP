import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, CheckCircle, Clock } from "lucide-react";

const difficultyColors = {
  'Básico': 'bg-green-100 text-green-800',
  'Intermedio': 'bg-yellow-100 text-yellow-800',
  'Avanzado': 'bg-red-100 text-red-800'
};

export default function TutorialCard({ tutorial, isCompleted, onStart }) {
  const Icon = tutorial.icon;

  return (
    <Card className={`hover:shadow-lg transition-all duration-200 border-0 ${
      isCompleted ? 'bg-green-50 border-green-200' : 'bg-white hover:translate-y-[-2px]'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isCompleted ? 'bg-green-500' : 'bg-blue-100'}`}>
              {isCompleted ? (
                <CheckCircle className="w-5 h-5 text-white" />
              ) : (
                <Icon className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg leading-tight">{tutorial.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={difficultyColors[tutorial.difficulty]}>
                  {tutorial.difficulty}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-slate-500">
                  <Clock className="w-3 h-3" />
                  {tutorial.duration}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          {tutorial.description}
        </p>
        
        <Button 
          onClick={onStart}
          className={`w-full ${
            isCompleted 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isCompleted ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Revisar Tutorial
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Comenzar
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}