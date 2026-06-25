"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "./order-status-badge";
import type { OrderStatus, OrderRow } from "@/types";
import { formatCurrency, formatDate, getTimeAgo } from "@/lib/utils";
import { Phone, User, Clock, ShoppingBag, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "@/lib/supabase";

interface OrderCardProps {
  order: OrderRow;
  onClaim?: (orderId: string) => void;
  claiming?: boolean;
}

export function OrderCard({ order, onClaim, claiming }: OrderCardProps) {
  const [claimedName, setClaimedName] = useState<string | null>(null);

  useEffect(() => {
    if (order.claimed_by && isSupabaseReady) {
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", order.claimed_by)
        .single()
        .then(({ data }) => {
          const d = data as { display_name: string } | null;
          if (d) setClaimedName(d.display_name);
        });
    }
  }, [order.claimed_by]);

  return (
    <Link href={`/orders/${order.id}`}>
      <Card className="group cursor-pointer transition-all duration-200 hover:border-gray-700 hover:shadow-xl hover:shadow-gray-900/50">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <h3 className="font-medium text-white truncate">{order.client_name}</h3>
                {order.country && (
                  <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded shrink-0">{order.country}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Phone className="h-3.5 w-3.5" />
                <span>{order.phone}</span>
              </div>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div className="flex items-center gap-1.5 text-gray-400">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{order.city}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-400">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>{order.product} x{order.quantity}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDate(order.order_date)}</span>
            </div>
            <div className="text-right font-semibold text-white">
              {formatCurrency(order.price * order.quantity)}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-800">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {claimedName ? (
                <>
                  <User className="h-3 w-3" />
                  <span>{claimedName}</span>
                </>
              ) : (
                <span className="text-blue-400">Non traitée</span>
              )}
              <span>· {getTimeAgo(order.created_at)}</span>
            </div>
            {!order.claimed_by && onClaim && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClaim(order.id); }}
                disabled={claiming}
                className="h-7 text-xs"
              >
                Prendre en charge
              </Button>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
