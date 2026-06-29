"use client";

import { useParams, useRouter } from "next/navigation";
import { useOrder, useClaimOrder, useUpdateOrderStatus, useAddNote, useMarkReadyForDelivery, useClaimDelivery, useUpdateDeliveryStatus } from "@/hooks/use-orders";
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
  History, StickyNote, User, Send, Calendar, Clock, ChevronDown, Truck, CheckCircle2, UserPlus,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { orderNoteSchema, type OrderNoteFormData } from "@/lib/validations";
import { useState, useEffect } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: order, isLoading, error } = useOrder(params.id as string);
  const { profile, isAdmin, role } = useAuth();
  const claimMutation = useClaimOrder();
  const statusMutation = useUpdateOrderStatus();
  const addNoteMutation = useAddNote();
  const markReadyMutation = useMarkReadyForDelivery();
  const claimDeliveryMutation = useClaimDelivery();
  const deliveryStatusMutation = useUpdateDeliveryStatus();
  const [estimatedTime, setEstimatedTime] = useState("");
  const [deliveryPersonName, setDeliveryPersonName] = useState<string | null>(null);
  const [claimedByName, setClaimedByName] = useState<string | null>(null);
  const [externalDelivery, setExternalDelivery] = useState("");
  const [savingExternal, setSavingExternal] = useState(false);

  useEffect(() => {
    if (!order || !isSupabaseReady) return;
    if (order.delivery_person_id) {
      supabase.from("profiles").select("display_name").eq("id", order.delivery_person_id).single()
        .then(({ data }) => setDeliveryPersonName((data as any)?.display_name || null));
    }
    if (order.claimed_by) {
      supabase.from("profiles").select("display_name").eq("id", order.claimed_by).single()
        .then(({ data }) => setClaimedByName((data as any)?.display_name || null));
    }
    setExternalDelivery(order.external_delivery_name || "");
  }, [order?.delivery_person_id, order?.claimed_by, order?.external_delivery_name]);

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
  const isDeliveryPerson = role === "delivery_person";
  const canClaimDelivery = order.ready_for_delivery && !order.delivery_person_id && isDeliveryPerson;
  const isMyDelivery = order.delivery_person_id === profile?.id;
  const canUpdateDelivery = isMyDelivery && !isFinal;
  const phoneFormatted = formatPhone(order.phone);
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(order.address + ", " + order.city)}`;

  const onAddNote = (data: OrderNoteFormData) => {
    addNoteMutation.mutate({ orderId: order.id, content: data.content }, { onSuccess: () => reset() });
  };

  const deliveryActions = ORDER_STATUSES.filter(
    (s) => s !== order.status && ["livrée", "refusée", "injoignable", "faux_numéro"].includes(s)
  );

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

            {!isDeliveryPerson && (
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
            )}

            {canClaim && (
              <Card>
                <CardContent className="p-6">
                  <Button onClick={() => claimMutation.mutate(order.id)} disabled={claimMutation.isPending} className="w-full">
                    Prendre en charge cette commande
                  </Button>
                </CardContent>
              </Card>
            )}

            {canClaimDelivery && (
              <Card>
                <CardContent className="p-6">
                  <Button onClick={() => claimDeliveryMutation.mutate(order.id)} disabled={claimDeliveryMutation.isPending} className="w-full">
                    <Truck className="mr-2 h-4 w-4" /> Prendre en charge la livraison
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

            {canUpdateDelivery && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Mettre à jour la livraison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {deliveryActions.length === 0 ? (
                      <p className="text-sm text-gray-500">Aucune action disponible</p>
                    ) : deliveryActions.map((status) => (
                      <Button key={status} variant={status === "livrée" ? "success" : "outline"} size="sm"
                        onClick={() => deliveryStatusMutation.mutate({ orderId: order.id, newStatus: status as OrderStatus })}
                        disabled={deliveryStatusMutation.isPending}
                      >
                        {STATUS_LABELS[status]}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Closer: Marquer prêt pour livraison */}
            {isOwner && !order.ready_for_delivery && !isFinal && !isDeliveryPerson && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-500" />
                    Préparer pour livraison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400">Horaire estimé de livraison (optionnel)</label>
                      <Input
                        type="datetime-local"
                        value={estimatedTime}
                        onChange={(e) => setEstimatedTime(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      onClick={() => markReadyMutation.mutate({ orderId: order.id, estimatedTime: estimatedTime || undefined })}
                      disabled={markReadyMutation.isPending}
                      className="w-full"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Marquer comme prête pour livraison
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Closer: A déjà marqué prête */}
            {isOwner && order.ready_for_delivery && !isFinal && !isDeliveryPerson && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm text-emerald-400 font-medium">Commande prête pour livraison</p>
                    {order.estimated_delivery_time && (
                      <p className="text-xs text-gray-500">Horaire prévu : {new Date(order.estimated_delivery_time).toLocaleString("fr-FR")}</p>
                    )}
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
                    Pris en charge par
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white font-medium">{claimedByName || "En attente"}</p>
                  {order.claimed_at && (
                    <p className="text-xs text-gray-500 mt-1">Depuis {getTimeAgo(order.claimed_at)}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {order.delivery_person_id && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Livraison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white font-medium">{deliveryPersonName || "Livreur"}</p>
                  {order.claimed_by_delivery_at && (
                    <p className="text-xs text-gray-500 mt-1">Pris en charge {getTimeAgo(order.claimed_by_delivery_at)}</p>
                  )}
                  {order.estimated_delivery_time && (
                    <p className="text-xs text-amber-400 mt-1">
                      Horaire prévu : {new Date(order.estimated_delivery_time).toLocaleString("fr-FR")}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {(isOwner || isAdmin) && !order.delivery_person_id && order.country === "Congo" && order.city === "Pointe Noire" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-blue-400" />
                    Livreur externe (Pointe Noire)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nom du livreur"
                      value={externalDelivery}
                      onChange={(e) => setExternalDelivery(e.target.value)}
                    />
                    <Button size="sm" disabled={savingExternal || !externalDelivery}
                      onClick={async () => {
                        setSavingExternal(true);
                        await supabase.from("orders").update({ external_delivery_name: externalDelivery }).eq("id", order.id);
                        setSavingExternal(false);
                      }}
                    >
                      OK
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {(isOwner || isAdmin) && order.external_delivery_name && (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <UserPlus className="h-5 w-5 text-blue-400 shrink-0" />
                  <div>
                    <p className="text-sm text-blue-400 font-medium">Livreur externe</p>
                    <p className="text-sm text-white">{order.external_delivery_name}</p>
                  </div>
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
