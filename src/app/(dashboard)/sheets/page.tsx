"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSheetsConfigs, useAddSheetConfig, useDeleteSheetConfig, useSyncSheet } from "@/hooks/use-sheets";
import { useAuth } from "@/providers/auth-provider";
import type { TeamRow } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/layout/header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, RefreshCw, FileSpreadsheet, Loader2, Globe, ChevronDown, ChevronRight, ArrowRight, Eye } from "lucide-react";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";

const COLUMNS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const FIELD_LABELS: Record<string, string> = {
  clientName: "Nom du client",
  phone: "Téléphone",
  city: "Ville",
  address: "Adresse",
  product: "Produit",
  quantity: "Quantité",
  price: "Prix",
  comments: "Commentaires",
  orderDate: "Date commande",
  country: "Pays",
};

const FIELD_DESC: Record<string, string> = {
  clientName: "Obligatoire",
  phone: "Obligatoire",
  city: "Optionnel",
  address: "Optionnel",
  product: "Optionnel",
  quantity: "Optionnel (défaut: 1)",
  price: "Optionnel (défaut: 0)",
  comments: "Optionnel",
  orderDate: "Optionnel (défaut: aujourd'hui)",
  country: "Optionnel (routage équipe)",
};

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function fetchSheetPreview(url: string): Promise<{ headers: string[]; rows: string[][] }> {
  const sheetId = extractSheetId(url);
  if (!sheetId) return { headers: [], rows: [] };
  try {
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`,
      { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" }
    );
    if (!res.ok) return { headers: [], rows: [] };
    const text = await res.text();
    const lines = text.split("\n").filter(Boolean);
    if (lines.length === 0) return { headers: [], rows: [] };
    const parse = (line: string) => {
      const parts: string[] = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i], nxt = line[i + 1];
        if (ch === '"') { if (inQ && nxt === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (ch === "," && !inQ) { parts.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      parts.push(cur.trim());
      return parts;
    };
    const headers = parse(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
    const rows = lines.slice(1, 4).map((l) => parse(l).map((c) => c.replace(/^"|"$/g, "")));
    return { headers, rows };
  } catch {
    return { headers: [], rows: [] };
  }
}

const COUNTRIES = [
  "Afrique du Sud", "Algérie", "Angola", "Bénin", "Botswana", "Burkina Faso",
  "Burundi", "Cameroun", "Cap-Vert", "Comores", "Congo", "Côte d'Ivoire",
  "Djibouti", "Égypte", "Érythrée", "Eswatini", "Éthiopie", "Gabon",
  "Gambie", "Ghana", "Guinée", "Guinée-Bissau", "Guinée équatoriale",
  "Kenya", "Lesotho", "Liberia", "Libye", "Madagascar", "Malawi", "Mali",
  "Maroc", "Maurice", "Mauritanie", "Mozambique", "Namibie", "Niger",
  "Nigeria", "Ouganda", "RCA", "RDC", "Rwanda", "Sao Tomé-et-Principe",
  "Sénégal", "Seychelles", "Sierra Leone", "Somalie", "Soudan",
  "Soudan du Sud", "Tanzanie", "Tchad", "Togo", "Tunisie", "Zambie",
  "Zimbabwe", "France", "Autre",
];

export default function SheetsPage() {
  const { isAdmin, profile } = useAuth();
  const { data: configs, isLoading } = useSheetsConfigs();
  const addMutation = useAddSheetConfig();
  const deleteMutation = useDeleteSheetConfig();
  const syncMutation = useSyncSheet();
  const [syncResults, setSyncResults] = useState<Record<string, { message: string; error?: boolean }>>({});
  const [syncingAll, setSyncingAll] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const autoSyncRef = useRef(autoSync);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addError, setAddError] = useState("");

  // Formulaire d'ajout
  const [form, setForm] = useState({ name: "", sheetUrl: "", country: "", teamId: "" });
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [detecting, setDetecting] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [editMapping, setEditMapping] = useState<Record<string, string>>({});
  const [editPreview, setEditPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [editShowPreview, setEditShowPreview] = useState<string | null>(null);

  useEffect(() => { autoSyncRef.current = autoSync; }, [autoSync]);

  useEffect(() => {
    if (!isSupabaseReady) return;
    supabase.from("teams").select("*").then(({ data }) => setTeams(data || []));
  }, []);

  useEffect(() => {
    if (!autoSync) return;
    const interval = setInterval(async () => {
      const res = await fetch("/api/sync-all");
      const data = await res.json();
      if (data.results) {
        const results: Record<string, { message: string; error?: boolean }> = {};
        data.results.forEach((msg: string) => {
          const name = msg.split(":")[0];
          results[name] = { message: msg, error: msg.includes("inaccessible") };
        });
        setSyncResults(results);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [autoSync]);

  const detectColumns = useCallback(async (url: string) => {
    if (!url || url.length < 40) return;
    setDetecting(true);
    const { headers, rows } = await fetchSheetPreview(url);
    setSheetHeaders(headers);
    setPreviewRows(rows);
    if (headers.length > 0) {
      const auto: Record<string, string> = {};
      headers.forEach((h, idx) => {
        const col = COLUMNS[idx] || "";
        const l = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (l.includes("nom") || l.includes("client") || l.includes("name") || l.includes("prenom") || l.includes("full")) auto.clientName = col;
        else if (l.includes("tel") || l.includes("phone") || l.includes("mobile") || l.includes("portable") || l.includes("whatsapp")) auto.phone = col;
        else if (l.includes("ville") || l.includes("city") || l.includes("localite") || l.includes("commune")) auto.city = col;
        else if (l.includes("adresse") || l.includes("address") || l.includes("addr") || l.includes("rue") || l.includes("domicile")) auto.address = col;
        else if (l.includes("produit") || l.includes("product") || l.includes("article") || l.includes("reference") || l.includes("ref") || l.includes("item")) auto.product = col;
        else if (l.includes("quantite") || l.includes("quantity") || l.includes("qte") || l.includes("qty") || l.includes("nombre")) auto.quantity = col;
        else if (l.includes("prix") || l.includes("price") || l.includes("montant") || l.includes("cout") || l.includes("tarif") || l.includes("pu")) auto.price = col;
        else if (l.includes("comment") || l.includes("note") || l.includes("remarque") || l.includes("observ") || l.includes("detail")) auto.comments = col;
        else if (l.includes("date") || l.includes("order") || l.includes("commande") || l.includes("creation")) auto.orderDate = col;
        else if (l.includes("pays") || l.includes("country") || l.includes("pai") || l.includes("zone")) auto.country = col;
      });
      setMapping((prev) => ({ ...prev, ...auto }));
    }
    setDetecting(false);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    const clean = { ...mapping };
    Object.keys(clean).forEach((k) => { if (!clean[k]) delete clean[k]; });
    try {
      await addMutation.mutateAsync({
        name: form.name,
        sheet_url: form.sheetUrl,
        country: form.country,
        team_id: form.teamId || undefined,
        column_mapping: Object.keys(clean).length > 0 ? clean : undefined,
      });
      setForm({ name: "", sheetUrl: "", country: "", teamId: "" });
      setMapping({});
      setSheetHeaders([]);
      setPreviewRows([]);
      setDialogOpen(false);
    } catch (err: any) {
      setAddError(err.message || "Erreur lors de l'ajout");
    }
  };

  const saveEditMapping = async (configId: string, newMapping: Record<string, string>) => {
    const clean = { ...newMapping };
    Object.keys(clean).forEach((k) => { if (!clean[k]) delete clean[k]; });
    await supabase.from("sheets_config").update({ column_mapping: clean }).eq("id", configId);
    setEditingConfig(null);
    setEditPreview(null);
  };

  const loadEditPreview = async (url: string, existingMapping: Record<string, string>) => {
    const { headers, rows } = await fetchSheetPreview(url);
    setEditPreview({ headers, rows });
    setEditMapping({ ...existingMapping });
  };

  const renderMappingEditor = (
    headers: string[],
    currentMapping: Record<string, string>,
    onChange: (field: string, col: string) => void
  ) => (
    <div className="space-y-1">
      {Object.entries(FIELD_LABELS).map(([field, label]) => {
        const col = currentMapping[field] || "";
        const colIdx = col ? COLUMNS.indexOf(col) : -1;
        const detectedName = colIdx >= 0 && colIdx < headers.length ? headers[colIdx] : "";
        return (
          <div key={field} className="flex items-center gap-2 py-1.5 border-b border-gray-800/50 last:border-0">
            <div className="w-32 shrink-0">
              <p className="text-sm text-white">{label}</p>
              <p className="text-[10px] text-gray-500">{FIELD_DESC[field]}</p>
            </div>
            <ArrowRight className="h-3 w-3 text-gray-600 shrink-0" />
            <select
              value={col}
              onChange={(e) => onChange(field, e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white"
            >
              <option value="">— Ne pas importer —</option>
              {headers.map((h, i) => (
                <option key={i} value={COLUMNS[i] || ""}>
                  {COLUMNS[i] || "?"} = {h}
                </option>
              ))}
              {headers.length === 0 && COLUMNS.slice(0, 20).map((c, i) => (
                <option key={c} value={c}>Colonne {c}</option>
              ))}
            </select>
            {detectedName && col && (
              <span className="text-[10px] text-emerald-500 whitespace-nowrap">✓ {detectedName}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderPreview = (headers: string[], rows: string[][], mapping: Record<string, string>) => {
    if (headers.length === 0) return null;
    return (
      <div className="overflow-x-auto text-xs">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              {headers.map((h, i) => (
                <th key={i} className="px-2 py-1 text-left text-gray-400 font-medium whitespace-nowrap">{COLUMNS[i] || i}={h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-gray-800/50">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-2 py-1 text-gray-300 whitespace-nowrap max-w-[150px] truncate">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <Header title="Google Sheets" />
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-medium text-white">Importation de commandes</h2>
            <p className="text-sm text-gray-400 mt-1">
              Liez un Google Sheet et associez ses colonnes une par une
            </p>
          </div>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" disabled={syncingAll}
                onClick={async () => {
                  setSyncingAll(true); setSyncResults({});
                  try {
                    const res = await fetch("/api/sync-all");
                    const data = await res.json();
                    if (data.results) {
                      const r: Record<string, { message: string; error?: boolean }> = {};
                      data.results.forEach((msg: string) => {
                        const n = msg.split(":")[0];
                        r[n] = { message: msg, error: msg.includes("inaccessible") };
                      });
                      setSyncResults(r);
                    }
                  } catch { /* */ }
                  setSyncingAll(false);
                }}>
                {syncingAll ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                Sync tout
              </Button>
              <Button variant={autoSync ? "default" : "outline"} size="sm" onClick={() => setAutoSync(!autoSync)}>
                Auto {autoSync ? "ON" : "OFF"}
              </Button>
              <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setSheetHeaders([]); setPreviewRows([]); setMapping({}); } }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Ajouter un Sheet</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Configuration du Google Sheet</DialogTitle></DialogHeader>
                  <form onSubmit={handleAdd} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Nom</label>
                        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="Ex: Commandes CI" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Pays par défaut</label>
                        <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                          <option value="">Depuis la colonne "Pays"</option>
                          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    {teams.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Équipe (optionnel)</label>
                        <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                          <option value="">Sheet général (non lié à une équipe)</option>
                          {teams.map((t) => <option key={t.id} value={t.id}>{t.name} {t.country ? `- ${t.country}` : ""}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">URL du Google Sheet</label>
                      <Input value={form.sheetUrl} onChange={(e) => {
                        setForm({ ...form, sheetUrl: e.target.value });
                        detectColumns(e.target.value);
                      }} placeholder="https://docs.google.com/spreadsheets/d/..." required />
                      {detecting && <p className="text-xs text-blue-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Lecture du sheet...</p>}
                    </div>

                    {sheetHeaders.length > 0 && (
                      <>
                        <div className="rounded-lg bg-gray-800/40 border border-gray-700 p-3">
                          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Eye className="h-3 w-3" /> Aperçu des données ({sheetHeaders.length} colonnes détectées)</p>
                          {renderPreview(sheetHeaders, previewRows, mapping)}
                        </div>

                        <div>
                          <p className="text-sm font-medium text-white mb-3">Associez les colonnes de votre sheet aux champs CloserFlow :</p>
                          {renderMappingEditor(sheetHeaders, mapping, (field, col) => setMapping((p) => ({ ...p, [field]: col })))}
                        </div>

                        <div className="rounded-lg bg-blue-600/10 border border-blue-600/20 p-3">
                          <p className="text-xs text-blue-400">
                            <strong>Astuce :</strong> Les colonnes marquées d'un ✓ vert sont déjà détectées automatiquement.
                            Vous pouvez les modifier si la détection ne correspond pas.
                            Seuls le Nom et le Téléphone sont obligatoires.
                          </p>
                        </div>
                      </>
                    )}

                    {addError && (
                      <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">{addError}</div>
                    )}
                    <Button type="submit" className="w-full" disabled={addMutation.isPending || detecting}>
                      {addMutation.isPending ? "Ajout..." : "Ajouter ce Sheet"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => <div key={i} className="h-32 bg-gray-900/50 rounded-xl animate-pulse" />)}
          </div>
        ) : configs && configs.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {configs.map((config) => {
              const cm = (config.column_mapping || {}) as Record<string, string>;
              return (
                <Card key={config.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10 shrink-0">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{config.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">{config.sheet_url}</p>
                          {config.country && <span className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">{config.country}</span>}
                          {config.team_id && <span className="text-[10px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded">{teams.find(t => t.id === config.team_id)?.name || "Équipe"}</span>}
                        </div>
                      </div>
                    </div>
                    <Badge variant={config.sync_enabled ? "green" : "gray"}>{config.sync_enabled ? "Actif" : "Inactif"}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {config.last_synced ? (
                          <><Globe className="h-3 w-3" /> Dernière synchro : {formatDate(config.last_synced)}</>
                        ) : (
                          <span className="text-amber-400">Jamais synchronisé</span>
                        )}
                      </div>
                      {syncResults[config.id] && (
                        <span className={`text-xs ${syncResults[config.id]?.error ? "text-red-400" : "text-emerald-400"}`}>
                          {syncResults[config.id]?.message}
                        </span>
                      )}
                    </div>

                    <div className="rounded-lg bg-gray-800/30 p-3 mb-3">
                      <p className="text-xs text-gray-400 mb-2">Mapping actuel :</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {Object.entries(FIELD_LABELS).map(([field, label]) => {
                          const col = cm[field];
                          return col ? (
                            <div key={field} className="flex items-center gap-1 text-xs">
                              <span className="text-gray-500">{label}:</span>
                              <span className="text-gray-300 font-mono">{col}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>

                    {editShowPreview === config.id && (
                      <div className="mb-3">
                        <Button variant="outline" size="sm" className="text-xs"
                          onClick={async () => {
                            await loadEditPreview(config.sheet_url, cm);
                          }}>
                          <Eye className="mr-1 h-3 w-3" /> Voir les colonnes du sheet
                        </Button>
                        {editPreview && (
                          <div className="mt-2 rounded-lg bg-gray-800/40 border border-gray-700 p-3">
                            <p className="text-xs text-gray-400 mb-2">Colonnes du sheet :</p>
                            {renderPreview(editPreview.headers, editPreview.rows, editMapping)}
                            <div className="mt-3">
                              <p className="text-xs text-gray-400 mb-2">Modifier l'association :</p>
                              {renderMappingEditor(editPreview.headers, editMapping, (field, col) => setEditMapping((p) => ({ ...p, [field]: col })))}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" onClick={() => saveEditMapping(config.id, editMapping)}>Sauvegarder le mapping</Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditShowPreview(null); setEditPreview(null); }}>Fermer</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm"
                          onClick={async () => {
                            try {
                              setSyncResults((p) => ({ ...p, [config.id]: { message: "Synchro..." } }));
                              const res = await syncMutation.mutateAsync(config.id);
                              setSyncResults((p) => ({ ...p, [config.id]: { message: res.message } }));
                            } catch (e: any) {
                              setSyncResults((p) => ({ ...p, [config.id]: { message: e.message, error: true } }));
                            }
                          }}
                          disabled={syncMutation.isPending}>
                          {syncMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                          Sync
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={async () => {
                            if (!confirm("Supprimer toutes les commandes importées depuis ce sheet pour les réimporter ?")) return;
                            try {
                              const res = await fetch("/api/sync-sheet", {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ configId: config.id }),
                              });
                              const data = await res.json();
                              setSyncResults((p) => ({ ...p, [config.id]: { message: data.message } }));
                            } catch (e: any) {
                              setSyncResults((p) => ({ ...p, [config.id]: { message: e.message, error: true } }));
                            }
                          }}
                          className="text-amber-400 hover:text-amber-300">
                          Réimporter
                        </Button>
                        <Button variant="ghost" size="sm"
                          onClick={() => setEditShowPreview(editShowPreview === config.id ? null : config.id)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(config.id)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <FileSpreadsheet className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400">Aucun sheet configuré</h3>
            <p className="text-sm text-gray-600">Ajoutez un Google Sheet pour importer les commandes</p>
          </div>
        )}
      </div>
    </div>
  );
}
