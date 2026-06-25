"use client";

import { useParams, useRouter } from "next/navigation";
import { useOrder, useClaimOrder, useUpdateOrderStatus, useAddNote } from "@/hooks/use-orders";
import { useAuth } from "@/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/layout/header";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ORDER_STATUSES, STATUS_LABELS, FINAL_STATUSES } from "@/types";
import type { OrderStatus, NoteEntry, HistoryEntry } from "@/types";
import { formatCurrency, formatDateTime, formatPhone, getTimeAgo } from "@/lib/utils";
import {
  Phone, Copy, Map, ArrowLeft, ShoppingBag,
  History, StickyNote, User, Send, Calendar, Clock, ChevronDown,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { orderNoteSchema, type OrderNoteFormData } from "@/lib/validations";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: order, isLoading, error } = useOrder(params.id as string);
  const { profile, isAdmin } = useAuth();
  const claimMutation = useClaimOrder();
  const statusMutation = useUpdateOrderStatus();
  const addNoteMutation = useAddNote();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrderNoteFormData>({
    resolver: zodResolver(orderNoteSchema),
  });

  if (isLoading) {
    return (
      <div>
        <Header title="Détail de la commande" />
        <div className="p-4 lg:p-6"><div className="h-96 bg-gray-900/50 rounded-xl animate-pulse" /></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div>
        <Header title="Détail de la commande" />
        <div className="p-4 lg:p-6 text-center">
          <p className="text-red-400">Commande introuvable</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">Retour</Button>
        </div>
      </div>
    );
  }

  const isFinal = FINAL_STATUSES.includes(order.status);
  const isOwner = order.claimed_by === profile?.id;
  const canModify = (isOwner || isAdmin) && !isFinal;
  const canClaim = !order.claimed_by && !isFinal;
  const phoneFormatted = formatPhone(order.phone);
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(order.address + ", " + order.city)}`;

  const onAddNote = (data: OrderNoteFormData) => {
    addNoteMutation.mutate({ orderId: order.id, content: data.content }, { onSuccess: () => reset() });
  };

  const history: HistoryEntry[] = order.order_history || [];
  const notes: NoteEntry[] = order.order_notes || [];

  return (
    <div>
      <Header title="Détail de la commande" />
      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-lg lg:text-xl truncate">{order.client_name}</CardTitle>
                  <p className="text-sm text-gray-400 mt-1">Commande #{order.id.slice(0, 8)}</p>
                </div>
                <OrderStatusBadge status={order.status} className="text-sm px-3 py-1 shrink-0" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Téléphone</label>
                      <p className="text-white font-medium mt-1">{order.phone}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Ville</label>
                      <p className="text-white font-medium mt-1">{order.city}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Adresse</label>
                      <p className="text-white mt-1">{order.address}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Produit</label>
                      <p className="text-white font-medium mt-1">{order.product}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Quantité</label>
                      <p className="text-white font-medium mt-1">{order.quantity}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Prix unitaire</label>
                      <p className="text-white font-medium mt-1">{formatCurrency(order.price)}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Total</label>
                      <p className="text-xl font-bold text-white mt-1">{formatCurrency(order.price * order.quantity)}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Source</label>
                      <p className="text-white mt-1">{order.source || "Import manuel"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Pays</label>
                      <p className="text-white font-medium mt-1">{order.country || "-"}</p>
                    </div>
                  </div>
                </div>
                {order.comments && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Commentaires</label>
                    <p className="text-gray-300 mt-1">{order.comments}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Actions rapides
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <a href={`tel:${phoneFormatted}`}>
                    <Button variant="success" size="sm" className="lg:hidden"><Phone className="mr-1 h-4 w-4" /> Appel</Button>
                    <Button variant="success" className="hidden lg:inline-flex"><Phone className="mr-2 h-4 w-4" /> Appeler</Button>
                  </a>
                  <Button variant="outline" size="sm" className="lg:hidden" onClick={() => navigator.clipboard.writeText(order.phone)}>
                    <Copy className="mr-1 h-4 w-4" /> Copier
                  </Button>
                  <Button variant="outline" className="hidden lg:inline-flex" onClick={() => navigator.clipboard.writeText(order.phone)}>
                    <Copy className="mr-2 h-4 w-4" /> Copier le numéro
                  </Button>
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="lg:hidden"><Map className="mr-1 h-4 w-4" /> Maps</Button>
                    <Button variant="outline" className="hidden lg:inline-flex"><Map className="mr-2 h-4 w-4" /> Google Maps</Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            {canClaim && (
              <Card>
                <CardContent className="p-6">
                  <Button onClick={() => claimMutation.mutate(order.id)} disabled={claimMutation.isPending} className="w-full">
                    Prendre en charge cette commande
                  </Button>
                </CardContent>
              </Card>
            )}

            {canModify && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ChevronDown className="h-4 w-4" />
                    Changer le statut
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {ORDER_STATUSES.filter((s) => s !== order.status).map((status) => (
                      <Button key={status} variant="outline" size="sm"
                        onClick={() => statusMutation.mutate({ orderId: order.id, newStatus: status as OrderStatus })}
                        disabled={statusMutation.isPending}
                      >
                        {STATUS_LABELS[status]}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Notes internes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onAddNote)} className="flex gap-2 mb-4">
                  <Input placeholder="Ajouter une note..." {...register("content")} />
                  <Button type="submit" size="icon" disabled={addNoteMutation.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                {notes.length > 0 ? (
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <div key={note.id} className="p-3 rounded-lg bg-gray-800/30">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-3 w-3 text-gray-500" />
                          <span className="text-xs font-medium text-gray-300">{note.user_name}</span>
                          <span className="text-xs text-gray-600">{getTimeAgo(note.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-400">{note.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">Aucune note</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 lg:space-y-6">
            {order.claimed_by && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Prise en charge
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white font-medium">{order.claimed_by}</p>
                  {order.claimed_at && (
                    <p className="text-xs text-gray-500 mt-1">Depuis {getTimeAgo(order.claimed_at)}</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Historique
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length > 0 ? (
                  <div className="space-y-3">
                    {[...history].reverse().map((entry, i) => (
                      <div key={entry.id || i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="h-2 w-2 rounded-full bg-blue-500/50 mt-1.5" />
                          {i < history.length - 1 && <div className="w-px flex-1 bg-gray-800" />}
                        </div>
                        <div className="flex-1 pb-3">
                          <p className="text-sm text-gray-300">{entry.action}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{formatDateTime(entry.created_at)}</p>
                          {entry.details && <p className="text-xs text-gray-500 mt-1">{entry.details}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">Aucun historique</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
