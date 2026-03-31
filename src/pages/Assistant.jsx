import React, { useState, useEffect, useRef } from "react";
import { agentSDK } from "@/agents";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageBubble from "../components/assistant/MessageBubble";
import { Send, Plus, Loader2, MessageSquare, Zap, Package } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AssistantPage() {
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const scrollAreaRef = useRef(null);

    const AGENT_NAME = "inventory_assistant";

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            try {
                const user = await User.me();
                setCurrentUser(user);
                const convs = await agentSDK.listConversations({ agent_name: AGENT_NAME });
                setConversations(convs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
            } catch (error) {
                console.error("Error loading initial data:", error);
            }
            setIsLoading(false);
        };
        loadInitialData();
    }, []);

    useEffect(() => {
        if (activeConversation) {
            const unsubscribe = agentSDK.subscribeToConversation(activeConversation.id, (data) => {
                setMessages(data.messages);
                setIsSending(false); // Stop sending indicator when response starts streaming
            });
            return () => unsubscribe();
        }
    }, [activeConversation]);

    useEffect(() => {
        // Scroll to bottom when messages update
        if (scrollAreaRef.current) {
            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                viewport.scrollTop = viewport.scrollHeight;
            }
        }
    }, [messages]);

    const handleCreateConversation = async () => {
        try {
            const newConv = await agentSDK.createConversation({
                agent_name: AGENT_NAME,
                metadata: {
                    name: `Chat de Inventario - ${new Date().toLocaleString()}`,
                }
            });
            const convs = await agentSDK.listConversations({ agent_name: AGENT_NAME });
            setConversations(convs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
            setActiveConversation(newConv);
            setMessages([]);
        } catch (error) {
            console.error("Error creating conversation:", error);
        }
    };

    const handleSelectConversation = (conv) => {
        setActiveConversation(conv);
        setMessages(conv.messages || []);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeConversation || isSending) return;

        setIsSending(true);
        const userMessage = { role: "user", content: newMessage };
        setMessages(prev => [...prev, userMessage]); // Optimistic update
        setNewMessage("");

        try {
            await agentSDK.addMessage(activeConversation, userMessage);
        } catch (error) {
            console.error("Error sending message:", error);
            setIsSending(false); // Reset on error
        }
    };

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-80 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                        Conversaciones
                    </h2>
                </div>
                <div className="p-4">
                    <Button onClick={handleCreateConversation} className="w-full gap-2">
                        <Plus className="w-4 h-4" /> Nueva Conversación
                    </Button>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-2">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-full">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                            </div>
                        ) : (
                            conversations.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => handleSelectConversation(conv)}
                                    className={`w-full text-left p-3 rounded-lg transition-colors ${activeConversation?.id === conv.id ? 'bg-blue-50' : 'hover:bg-slate-100'}`}
                                >
                                    <p className={`font-medium text-sm ${activeConversation?.id === conv.id ? 'text-blue-700' : 'text-slate-800'}`}>Chat de Inventario</p>
                                    <p className="text-xs text-slate-500">
                                        {format(new Date(conv.created_date), 'dd MMM, yyyy HH:mm', { locale: es })}
                                    </p>
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col">
                <CardHeader className="bg-white border-b border-slate-200">
                    <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-3">
                         <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-md">
                            <Package className="w-4 h-4" />
                        </div>
                        Asistente de Inventario
                    </h1>
                </CardHeader>
                <div className="flex-1 overflow-hidden">
                   <ScrollArea className="h-full" ref={scrollAreaRef}>
                        <div className="p-6">
                            {activeConversation ? (
                                messages.map((msg, index) => (
                                    <MessageBubble key={index} message={msg} user={currentUser} />
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                                    <Zap className="w-16 h-16 text-slate-300 mb-4" />
                                    <h3 className="text-xl font-semibold">Bienvenido al Asistente IA</h3>
                                    <p>Crea una nueva conversación o selecciona una existente para empezar.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
                 <div className="p-4 bg-white border-t border-slate-200">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-4">
                        <Input
                            placeholder={activeConversation ? "Escribe tu pregunta sobre el inventario..." : "Selecciona una conversación para empezar"}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            disabled={!activeConversation || isSending}
                            className="flex-1"
                        />
                        <Button type="submit" disabled={!newMessage.trim() || !activeConversation || isSending}>
                            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                    </form>
                </div>
            </main>
        </div>
    );
}