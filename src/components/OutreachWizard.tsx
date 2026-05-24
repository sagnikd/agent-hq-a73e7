import { useState, useRef } from "react";
import {
  ChevronRight,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Target,
  Check,
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Users,
  FileText,
  X,
} from "lucide-react";
import Modal, { FormField, PrimaryButton, TextArea, TextInput } from "./Modal";
import { call } from "@/lib/api";

type SourceType = "maps" | "upload";
type Step = "source-select" | "input" | "preview" | "upload" | "messaging" | "confirm" | "generating";
type StructuredQuery = { location: string; searchTerms: string[]; maxResults: number };

type ParsedLead = {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  jobTitle: string;
  geo: string;
  productFamily: string;
  topic: string;
  statusReason: string;
  rating: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (campaign: { id: string; name: string }) => void;
};

const EXAMPLE =
  "Personal injury law firms in Miami, FL with at least 4-star ratings. Also include family lawyers and estate planning attorneys in the greater Miami area.";

export default function OutreachWizard({ open, onClose, onCreated }: Props) {
  // Shared state
  const [step, setStep] = useState<Step>("source-select");
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Maps flow state
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(50);
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<StructuredQuery | null>(null);

  // Upload flow state
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [productFamilies, setProductFamilies] = useState<string[]>([]);
  const [selectedProductFamily, setSelectedProductFamily] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderCompany, setSenderCompany] = useState("");
  const [messagingDoc, setMessagingDoc] = useState("");
  const [generatingProgress, setGeneratingProgress] = useState<{ current: number; total: number; company: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("source-select");
    setSourceType(null);
    setBusy(false);
    setError(null);
    // Maps
    setName("");
    setQuery("");
    setMaxResults(50);
    setDescription("");
    setPreview(null);
    // Upload
    setParsedLeads([]);
    setUploadFileName(null);
    setProductFamilies([]);
    setSelectedProductFamily(null);
    setCampaignName("");
    setSenderName("");
    setSenderCompany("");
    setMessagingDoc("");
    setGeneratingProgress(null);
  }

  function close() {
    reset();
    onClose();
  }

  // ── Maps flow ──────────────────────────────────────────────────────

  async function runPreview() {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await call<StructuredQuery>("outreach.preview", {
        query: query.trim(),
        max_results: maxResults,
      });
      setPreview(result);
      setStep("preview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Preview failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function createCampaign() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const campaign = await call<{ id: string; name: string }>("outreach.campaign.create", {
        name: name.trim() || `Campaign · ${preview.location}`,
        query: query.trim(),
        structured_query: preview,
        description: description.trim(),
      });
      onCreated?.(campaign);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  // ── Upload flow ────────────────────────────────────────────────────

  async function handleFileSelect(file: File) {
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(arrayBuffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];

      const leads: ParsedLead[] = [];
      for (const row of rows) {
        const firstName = String(row["First Name"] ?? "").trim();
        const lastName = String(row["Last Name"] ?? "").trim();
        const nameField = String(row[" Name"] ?? row["Name"] ?? "").trim();
        const computedName = `${firstName} ${lastName}`.trim() || nameField;
        const email = String(row["Email"] ?? "").trim();
        const company = String(row["Company Name"] ?? "").trim();
        if (!email && !company) continue;
        leads.push({
          name: computedName,
          firstName,
          lastName,
          email,
          company,
          jobTitle: String(row["Job Title"] ?? "").trim(),
          geo: String(row["GEO"] ?? "").trim(),
          productFamily: String(row["Primary Product Family"] ?? "").trim(),
          topic: String(row["Topic"] ?? "").trim(),
          statusReason: String(row["Status Reason"] ?? "").trim(),
          rating: String(row["Rating"] ?? "").trim(),
        });
      }

      const familySet = new Set<string>();
      for (const l of leads) {
        if (l.productFamily) familySet.add(l.productFamily);
      }
      const families = Array.from(familySet).sort();

      setParsedLeads(leads);
      setUploadFileName(file.name);
      setProductFamilies(families);
      setSelectedProductFamily(families.length === 1 ? families[0] : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  async function createUploadCampaign() {
    if (!selectedProductFamily) return;
    const filteredLeads = parsedLeads.filter((l) => l.productFamily === selectedProductFamily);

    setBusy(true);
    setError(null);
    try {
      const campaign = await call<{ id: string; name: string }>("outreach.campaign.create", {
        name: campaignName.trim() || `${selectedProductFamily} · Upload`,
        query: `Uploaded leads — ${selectedProductFamily}`,
        description: `Excel upload · ${filteredLeads.length} leads · ${selectedProductFamily}`,
      });

      await call("outreach.leads.bulk_add", {
        campaign_id: campaign.id,
        leads: filteredLeads.map((l) => ({
          name: l.name,
          email: l.email,
          company: l.company,
          job_title: l.jobTitle,
          notes: [l.jobTitle, l.geo, l.topic, l.statusReason, l.rating].filter(Boolean).join(" · "),
        })),
      });

      setStep("generating");
      setBusy(false);

      const leadsList = await call<{ items: Array<{ id: string; name: string; email: string; company: string }> }>(
        "outreach.leads.list",
        { campaign_id: campaign.id },
      );
      const leads = (leadsList as unknown as Array<{ id: string; name: string; email: string; company: string }>);

      for (let leadIndex = 0; leadIndex < leads.length; leadIndex++) {
        const lead = leads[leadIndex];
        setGeneratingProgress({ current: leadIndex + 1, total: leads.length, company: lead.company || lead.name });
        const previousSteps: Array<{ step: number; subject: string; body_text: string }> = [];
        for (const stepNum of [1, 2, 3]) {
          const draft = await call<{ subject: string; body_text: string; body_html: string }>(
            "outreach.emails.generate_one",
            {
              campaign_id: campaign.id,
              lead_id: lead.id,
              sender_name: senderName,
              sender_company: senderCompany,
              messaging_doc: messagingDoc,
              framework: "sdr",
              step: stepNum,
              total_steps: 3,
              previous_steps: previousSteps,
            },
          );
          previousSteps.push({ step: stepNum, subject: draft.subject, body_text: draft.body_text });
        }
      }

      onCreated?.(campaign);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Campaign creation failed");
      setBusy(false);
      setStep("confirm");
    }
  }

  // ── Derived ────────────────────────────────────────────────────────

  const filteredCount = selectedProductFamily
    ? parsedLeads.filter((l) => l.productFamily === selectedProductFamily).length
    : 0;

  const familyCounts: Record<string, number> = {};
  for (const l of parsedLeads) {
    if (l.productFamily) familyCounts[l.productFamily] = (familyCounts[l.productFamily] ?? 0) + 1;
  }

  const isGenerating = step === "generating";

  // ── Render ─────────────────────────────────────────────────────────

  const titleMap: Record<Step, string> = {
    "source-select": "New campaign",
    input: "Describe your target market",
    preview: "Review search strategy",
    upload: "Upload leads",
    messaging: "Who's reaching out?",
    confirm: "Ready to launch",
    generating: "Generating emails...",
  };

  const descMap: Record<Step, string> = {
    "source-select": "Choose how you want to find leads.",
    input: "Natural language in. Structured Google Maps queries out.",
    preview: "Gemini turned your description into a location plus multiple search terms.",
    upload: "Import from a CRM Excel export and send personalized sequences.",
    messaging: "Tell Gemini who is sending and paste your product brief.",
    confirm: "Review everything before kicking off email generation.",
    generating: "",
  };

  return (
    <Modal
      open={open}
      onClose={isGenerating ? () => {} : close}
      title={titleMap[step]}
      description={descMap[step]}
      maxWidth="max-w-2xl"
    >
      {/* ── Source select ─────────────────────────────────────────── */}
      {step === "source-select" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Maps card */}
            <button
              type="button"
              onClick={() => setSourceType("maps")}
              className={`rounded-xl border-2 p-5 text-left cursor-pointer transition ${
                sourceType === "maps"
                  ? "border-primary bg-primary/5"
                  : "border-slate-200 hover:border-primary"
              }`}
            >
              <MapPin size={24} className="text-primary mb-3" />
              <p className="font-semibold text-slate-900 mb-1">Google Maps Scraping</p>
              <p className="text-xs text-slate-500">
                Describe your ICP and Gemini + Apify find matching businesses automatically.
              </p>
            </button>

            {/* Upload card */}
            <button
              type="button"
              onClick={() => setSourceType("upload")}
              className={`rounded-xl border-2 p-5 text-left cursor-pointer transition ${
                sourceType === "upload"
                  ? "border-primary bg-primary/5"
                  : "border-slate-200 hover:border-primary"
              }`}
            >
              <FileSpreadsheet size={24} className="text-primary mb-3" />
              <p className="font-semibold text-slate-900 mb-1">Upload Leads</p>
              <p className="text-xs text-slate-500">
                Import from a CRM Excel export (Dynamics 365, Salesforce, etc.) and send personalized sequences.
              </p>
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <PrimaryButton
              onClick={() => {
                if (sourceType === "maps") setStep("input");
                else if (sourceType === "upload") setStep("upload");
              }}
              disabled={!sourceType}
            >
              Next <ChevronRight size={14} />
            </PrimaryButton>
            <button
              onClick={close}
              className="px-4 py-3 text-sm text-slate-500 hover:text-slate-900 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Maps: input ───────────────────────────────────────────── */}
      {step === "input" && (
        <div className="space-y-4">
          <FormField label="Campaign name" hint="For your own reference. Auto-derived if blank.">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Miami Law Firms · Q2"
              autoFocus
            />
          </FormField>

          <FormField label="Who are you targeting?" required hint="Describe the business type, location, and any filters.">
            <TextArea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={EXAMPLE}
              rows={5}
              spellCheck
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Max results" hint="Clamped to 10–200.">
              <TextInput
                type="number"
                min={10}
                max={200}
                value={maxResults}
                onChange={(e) => setMaxResults(Math.max(10, Math.min(200, Number(e.target.value))))}
              />
            </FormField>
            <FormField label="Description (optional)" hint="Internal note.">
              <TextInput
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Outbound pilot for Q2"
              />
            </FormField>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => { setStep("source-select"); setError(null); }}
              className="flex items-center gap-2 px-4 py-3 text-sm rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold transition"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <PrimaryButton onClick={runPreview} disabled={!query.trim() || busy} loading={busy}>
              {busy ? (
                <><Loader2 size={14} className="animate-spin" /> Analysing with Gemini</>
              ) : (
                <><Sparkles size={14} /> Preview search strategy</>
              )}
            </PrimaryButton>
            <button
              onClick={close}
              className="px-4 py-3 text-sm text-slate-500 hover:text-slate-900 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Maps: preview ─────────────────────────────────────────── */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={14} className="text-primary" />
              <span className="text-xs font-display tracking-widest uppercase text-slate-500 font-bold">Location</span>
            </div>
            <p className="text-lg font-medium text-slate-900">{preview.location}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search size={14} className="text-purple" />
              <span className="text-xs font-display tracking-widest uppercase text-slate-500 font-bold">
                Search queries ({preview.searchTerms.length})
              </span>
            </div>
            <ul className="space-y-2">
              {preview.searchTerms.map((term, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                  <ChevronRight size={14} className="text-primary shrink-0 mt-0.5" />
                  <span className="font-mono">{term}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
            <Target size={14} className="text-accent" />
            <span className="text-xs text-slate-600">
              Up to <span className="text-slate-900 font-bold">{preview.maxResults}</span> leads · Apify Google Maps scraper runs in Phase 3
            </span>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => { setStep("input"); setError(null); }}
              className="flex items-center gap-2 px-4 py-3 text-sm rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold transition"
            >
              <ArrowLeft size={14} /> Edit query
            </button>
            <PrimaryButton onClick={createCampaign} disabled={busy} loading={busy}>
              <Check size={14} /> Create campaign
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* ── Upload: file + product family ─────────────────────────── */}
      {step === "upload" && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed border-slate-300 p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary transition"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
            {uploadFileName ? (
              <>
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Check size={20} className="text-green-600" />
                </div>
                <p className="font-medium text-slate-900">{uploadFileName}</p>
                <p className="text-sm text-slate-500">{parsedLeads.length} leads parsed</p>
              </>
            ) : (
              <>
                <FileSpreadsheet size={32} className="text-slate-400" />
                <p className="font-medium text-slate-700">Drop your Excel export here or click to browse</p>
                <p className="text-xs text-slate-400">Supports .xlsx, .xls, .csv</p>
              </>
            )}
          </div>

          {/* Product family picker */}
          {productFamilies.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-500">Primary Product Family</p>
              <div className="space-y-2">
                {productFamilies.map((fam) => (
                  <label key={fam} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="productFamily"
                      value={fam}
                      checked={selectedProductFamily === fam}
                      onChange={() => setSelectedProductFamily(fam)}
                      className="accent-primary"
                    />
                    <span className="text-sm text-slate-800 flex-1">{fam}</span>
                    <span className="text-xs text-slate-400">{familyCounts[fam] ?? 0} leads</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Campaign name */}
          <FormField label="Campaign name" hint="Auto-derived from product family if blank.">
            <TextInput
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder={selectedProductFamily ? `${selectedProductFamily} · Upload` : "My campaign"}
            />
          </FormField>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => { setStep("source-select"); setError(null); }}
              className="flex items-center gap-2 px-4 py-3 text-sm rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold transition"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <PrimaryButton
              onClick={() => { setError(null); setStep("messaging"); }}
              disabled={!uploadFileName || !selectedProductFamily}
            >
              Next <ChevronRight size={14} />
            </PrimaryButton>
            <button
              onClick={close}
              className="px-4 py-3 text-sm text-slate-500 hover:text-slate-900 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Upload: messaging ─────────────────────────────────────── */}
      {step === "messaging" && (
        <div className="space-y-4">
          {/* Summary pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Users size={12} /> {filteredCount} leads
            </span>
            {selectedProductFamily && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                <FileSpreadsheet size={12} /> {selectedProductFamily}
              </span>
            )}
          </div>

          <FormField label="Sender name" required>
            <TextInput
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Jane Smith"
              autoFocus
            />
          </FormField>

          <FormField label="Sender company" required>
            <TextInput
              value={senderCompany}
              onChange={(e) => setSenderCompany(e.target.value)}
              placeholder="Acme Corp"
            />
          </FormField>

          <FormField
            label="MESSAGING DOC"
            required
            hint="Paste your product brief, value props, ICP notes, or talking points. Gemini will use this to craft personalized 3-touch emails."
          >
            <TextArea
              value={messagingDoc}
              onChange={(e) => setMessagingDoc(e.target.value)}
              rows={10}
              placeholder="Our product helps B2B SaaS companies..."
              spellCheck
            />
          </FormField>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => { setStep("upload"); setError(null); }}
              className="flex items-center gap-2 px-4 py-3 text-sm rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold transition"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <PrimaryButton
              onClick={() => { setError(null); setStep("confirm"); }}
              disabled={!senderName.trim() || !senderCompany.trim() || !messagingDoc.trim()}
            >
              Preview campaign <ChevronRight size={14} />
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* ── Upload: confirm ───────────────────────────────────────── */}
      {step === "confirm" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <Users size={14} className="text-primary mb-2" />
              <p className="text-xs text-slate-500 mb-0.5">Leads</p>
              <p className="font-semibold text-slate-900">{filteredCount}</p>
              <p className="text-xs text-slate-400 truncate">{selectedProductFamily}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <FileText size={14} className="text-primary mb-2" />
              <p className="text-xs text-slate-500 mb-0.5">Sequence</p>
              <p className="font-semibold text-slate-900 text-xs leading-snug">3-touch SDR</p>
              <p className="text-xs text-slate-400">Direct → Value-add → Breakup</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <Upload size={14} className="text-primary mb-2" />
              <p className="text-xs text-slate-500 mb-0.5">Source</p>
              <p className="font-semibold text-slate-900 text-xs">Uploaded Excel</p>
            </div>
          </div>

          {/* Sample leads */}
          {(() => {
            const sample = parsedLeads
              .filter((l) => l.productFamily === selectedProductFamily)
              .slice(0, 3);
            return sample.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">Sample leads</p>
                {sample.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-900 font-medium">{l.name || l.company}</span>
                    {l.company && l.name !== l.company && (
                      <span className="text-slate-400">· {l.company}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : null;
          })()}

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            Emails will be generated after campaign creation. This may take a minute.
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => { setStep("messaging"); setError(null); }}
              className="flex items-center gap-2 px-4 py-3 text-sm rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold transition"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <PrimaryButton onClick={createUploadCampaign} disabled={busy} loading={busy}>
              {busy ? (
                <><Loader2 size={14} className="animate-spin" /> Creating...</>
              ) : (
                <><Sparkles size={14} /> Create campaign &amp; generate emails</>
              )}
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* ── Upload: generating ────────────────────────────────────── */}
      {step === "generating" && generatingProgress && (
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Writing emails for <span className="font-medium text-slate-900">{generatingProgress.company}</span>...</span>
              <span>{generatingProgress.current} / {generatingProgress.total}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(generatingProgress.current / generatingProgress.total) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center">Please wait while Gemini drafts your 3-touch SDR sequence...</p>
        </div>
      )}
    </Modal>
  );
}
