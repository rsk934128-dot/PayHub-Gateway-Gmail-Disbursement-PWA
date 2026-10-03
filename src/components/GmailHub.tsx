import React, { useState, useEffect } from 'react';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  Tag,
  RefreshCw,
  Send,
  ExternalLink,
  LogOut,
  FolderPlus,
  FolderTree,
  Folder,
  SlidersHorizontal,
  Search,
  Check,
  AlertCircle,
  Inbox,
  Palette,
  ArrowRight,
  Lock,
} from 'lucide-react';
import {
  fetchRecentReceiptEmails,
  buildReceiptHtml,
  SentReceiptMessage,
} from '../services/gmail/gmail.service';
import { getAccessToken } from '../services/gmail/auth';
import {
  fetchAllGmailLabelsWithDetails,
  createCustomGmailLabel,
  saveGatewayLabelMapping,
  getMappedLabelForGateway,
  clearGatewayMappings,
  getLabelMappingPreferences,
  saveLabelMappingPreferences,
  subscribeToLabelMappingChanges,
  DetailedGmailLabel,
  DisbursementLabelMapping,
  GMAIL_PALETTE_COLORS,
} from '../services/gmail/labelManager.service';
import { GmailReceiptRequest } from '../types';

interface Props {
  isGmailConnected: boolean;
  userEmail?: string;
  userName?: string;
  userPhoto?: string;
  accessToken: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onRequestSendReceipt: (params: GmailReceiptRequest) => void;
  lang?: 'en' | 'bn';
}

// Initial preset labels available immediately on mount
const DEFAULT_PRESET_USER_LABELS: DetailedGmailLabel[] = [
  { id: 'Payments/Disbursed', name: 'Payments/Disbursed', type: 'user', messagesTotal: 0, messagesUnread: 0 },
  { id: 'Payments/Received', name: 'Payments/Received', type: 'user', messagesTotal: 0, messagesUnread: 0 },
  { id: 'Payments/bKash', name: 'Payments/bKash', type: 'user', messagesTotal: 0, messagesUnread: 0 },
  { id: 'Payments/Nagad', name: 'Payments/Nagad', type: 'user', messagesTotal: 0, messagesUnread: 0 },
  { id: 'Payments/Stripe', name: 'Payments/Stripe', type: 'user', messagesTotal: 0, messagesUnread: 0 },
];

const DEFAULT_PRESET_SYSTEM_LABELS: DetailedGmailLabel[] = [
  { id: 'INBOX', name: 'INBOX', type: 'system' },
  { id: 'SENT', name: 'SENT', type: 'system' },
  { id: 'IMPORTANT', name: 'IMPORTANT', type: 'system' },
  { id: 'TRASH', name: 'TRASH', type: 'system' },
];

export const GmailHub: React.FC<Props> = ({
  isGmailConnected,
  userEmail,
  userName,
  userPhoto,
  accessToken,
  onLogin,
  onLogout,
  onRequestSendReceipt,
  lang = 'en',
}) => {
  // Label lists - initialized on mount with standard presets, updated dynamically
  const [allLabels, setAllLabels] = useState<DetailedGmailLabel[]>([
    ...DEFAULT_PRESET_USER_LABELS,
    ...DEFAULT_PRESET_SYSTEM_LABELS,
  ]);
  const [userLabels, setUserLabels] = useState<DetailedGmailLabel[]>(DEFAULT_PRESET_USER_LABELS);
  const [systemLabels, setSystemLabels] = useState<DetailedGmailLabel[]>(DEFAULT_PRESET_SYSTEM_LABELS);
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);
  const [labelFilterTab, setLabelFilterTab] = useState<'user' | 'all' | 'system'>('user');
  const [labelSearch, setLabelSearch] = useState('');

  // Mapping configuration state - initialized immediately from localStorage via getMappedLabelForGateway
  const [gatewayMappings, setGatewayMappings] = useState<{
    BKASH: string;
    NAGAD: string;
    STRIPE: string;
  }>(() => ({
    BKASH: getMappedLabelForGateway('BKASH'),
    NAGAD: getMappedLabelForGateway('NAGAD'),
    STRIPE: getMappedLabelForGateway('STRIPE'),
  }));
  const [mapping, setMapping] = useState<DisbursementLabelMapping>(() => getLabelMappingPreferences());
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [mappingFeedback, setMappingFeedback] = useState<string | null>(null);

  // Settings interactive selectable list state for dynamic mapping
  const [settingsSelectedGateway, setSettingsSelectedGateway] = useState<'STRIPE' | 'BKASH' | 'NAGAD'>('STRIPE');
  const [settingsLabelSearch, setSettingsLabelSearch] = useState('');
  const [settingsTab, setSettingsTab] = useState<'all' | 'user' | 'system'>('all');

  // Create new custom label modal/state
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [selectedColor, setSelectedColor] = useState(GMAIL_PALETTE_COLORS[0]);
  const [assignGatewayAfterCreate, setAssignGatewayAfterCreate] = useState<'NONE' | 'BKASH' | 'NAGAD' | 'STRIPE'>('NONE');
  const [createLabelStatus, setCreateLabelStatus] = useState<string | null>(null);

  // Recent sent emails
  const [receiptEmails, setReceiptEmails] = useState<SentReceiptMessage[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);

  // Manual test send form
  const [testEmail, setTestEmail] = useState(userEmail || 'customer@example.com');
  const [testAmount, setTestAmount] = useState('2500');
  const [testGateway, setTestGateway] = useState<'BKASH' | 'NAGAD' | 'STRIPE'>('BKASH');
  const [showPreview, setShowPreview] = useState(false);

  const loadGmailLabelsAndMails = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token) return;
    setIsLoadingLabels(true);
    setIsLoadingEmails(true);

    try {
      const [labelData, mails] = await Promise.all([
        fetchAllGmailLabelsWithDetails(token).catch(() => ({
          all: [...DEFAULT_PRESET_USER_LABELS, ...DEFAULT_PRESET_SYSTEM_LABELS],
          userLabels: DEFAULT_PRESET_USER_LABELS,
          systemLabels: DEFAULT_PRESET_SYSTEM_LABELS,
        })),
        fetchRecentReceiptEmails(token, 8).catch(() => []),
      ]);

      if (labelData.all && labelData.all.length > 0) {
        setAllLabels(labelData.all);
        setUserLabels(labelData.userLabels);
        setSystemLabels(labelData.systemLabels);
      }
      setReceiptEmails(mails);
    } catch (err: any) {
      console.warn('Failed to load Gmail data:', err);
    } finally {
      setIsLoadingLabels(false);
      setIsLoadingEmails(false);
    }
  };

  useEffect(() => {
    // 1. Explicitly call getMappedLabelForGateway on mount to provide immediate feedback on existing configuration
    const bkashMapped = getMappedLabelForGateway('BKASH');
    const nagadMapped = getMappedLabelForGateway('NAGAD');
    const stripeMapped = getMappedLabelForGateway('STRIPE');

    setGatewayMappings({
      BKASH: bkashMapped,
      NAGAD: nagadMapped,
      STRIPE: stripeMapped,
    });

    setMapping((prev) => ({
      ...prev,
      bkashLabel: bkashMapped,
      nagadLabel: nagadMapped,
      stripeLabel: stripeMapped,
    }));

    // 2. Fetch label lists on mount
    const fetchLabelsOnMount = async () => {
      setIsLoadingLabels(true);
      try {
        const token = accessToken || (await getAccessToken());
        if (token) {
          const labelData = await fetchAllGmailLabelsWithDetails(token);
          if (labelData.all && labelData.all.length > 0) {
            setAllLabels(labelData.all);
            setUserLabels(labelData.userLabels);
            setSystemLabels(labelData.systemLabels);
          }
        }
      } catch (err) {
        console.warn('Could not dynamically fetch labels on mount:', err);
      } finally {
        setIsLoadingLabels(false);
      }
    };

    fetchLabelsOnMount();

    if (accessToken) {
      loadGmailLabelsAndMails();
    }

    const unsubscribe = subscribeToLabelMappingChanges((config) => {
      setMapping({
        defaultDisbursementLabel: config.defaultLabel,
        bkashLabel: config.mappings.BKASH,
        nagadLabel: config.mappings.NAGAD,
        stripeLabel: config.mappings.STRIPE,
        autoApplyLabels: config.autoApplyLabels,
      });
      setGatewayMappings({
        BKASH: config.mappings.BKASH,
        NAGAD: config.mappings.NAGAD,
        STRIPE: config.mappings.STRIPE,
      });
    });

    return () => unsubscribe();
  }, [accessToken]);

  // Handle saving label mappings
  const handleSaveMapping = () => {
    setIsSavingMapping(true);
    // Persist user-defined mappings using saveGatewayLabelMapping into localStorage
    saveGatewayLabelMapping('BKASH', mapping.bkashLabel);
    saveGatewayLabelMapping('NAGAD', mapping.nagadLabel);
    saveGatewayLabelMapping('STRIPE', mapping.stripeLabel);
    saveLabelMappingPreferences(mapping);

    // Refresh mapped values from getMappedLabelForGateway
    setGatewayMappings({
      BKASH: getMappedLabelForGateway('BKASH'),
      NAGAD: getMappedLabelForGateway('NAGAD'),
      STRIPE: getMappedLabelForGateway('STRIPE'),
    });

    setTimeout(() => {
      setIsSavingMapping(false);
      setMappingFeedback(
        lang === 'bn'
          ? 'গেটওয়ে লেবেল ম্যাপিং সফলভাবে সংরক্ষিত হয়েছে (bKash, Nagad, Stripe)!'
          : 'Gateway label settings saved for Stripe, bKash, and Nagad!'
      );
      setTimeout(() => setMappingFeedback(null), 3000);
    }, 300);
  };

  // Immediate single gateway mapping handler
  const handleGatewayMappingChange = (
    gateway: 'BKASH' | 'NAGAD' | 'STRIPE',
    labelIdOrName: string
  ) => {
    saveGatewayLabelMapping(gateway, labelIdOrName);
    const resolved = getMappedLabelForGateway(gateway);

    setGatewayMappings((prev) => ({
      ...prev,
      [gateway]: resolved,
    }));

    setMapping((prev) => ({
      ...prev,
      bkashLabel: gateway === 'BKASH' ? resolved : prev.bkashLabel,
      nagadLabel: gateway === 'NAGAD' ? resolved : prev.nagadLabel,
      stripeLabel: gateway === 'STRIPE' ? resolved : prev.stripeLabel,
    }));

    setMappingFeedback(
      lang === 'bn'
        ? `${gateway} এর জন্য ম্যাপ করা লেবেল "${resolved}" সংরক্ষিত হয়েছে!`
        : `Assigned ${gateway} receipts to Gmail label "${resolved}" (saved in localStorage)!`
    );
    setTimeout(() => setMappingFeedback(null), 3000);
  };

  // Reset all gateway mappings to default system folders
  const handleResetMappings = () => {
    const defaultCfg = clearGatewayMappings();
    setGatewayMappings({ ...defaultCfg.mappings });
    setMapping((prev) => ({
      ...prev,
      bkashLabel: defaultCfg.mappings.BKASH,
      nagadLabel: defaultCfg.mappings.NAGAD,
      stripeLabel: defaultCfg.mappings.STRIPE,
    }));
    setMappingFeedback(
      lang === 'bn'
        ? 'সকল গেটওয়ে ম্যাপিং ডিফল্ট কনফিগারেশনে রিসেট করা হয়েছে!'
        : 'All gateway label mappings reset to system defaults!'
    );
    setTimeout(() => setMappingFeedback(null), 3500);
  };

  // 1-Click Provision standard gateway sub-folders
  const handleQuickProvisionFolders = async () => {
    if (!accessToken) return;
    setIsLoadingLabels(true);
    try {
      const bkashFolder = 'Payments/bKash';
      const nagadFolder = 'Payments/Nagad';
      const stripeFolder = 'Payments/Stripe';

      await Promise.allSettled([
        createCustomGmailLabel(accessToken, { name: bkashFolder, backgroundColor: '#e1147e', textColor: '#ffffff' }),
        createCustomGmailLabel(accessToken, { name: nagadFolder, backgroundColor: '#ff7537', textColor: '#ffffff' }),
        createCustomGmailLabel(accessToken, { name: stripeFolder, backgroundColor: '#4986e7', textColor: '#ffffff' }),
      ]);

      const updatedMapping: DisbursementLabelMapping = {
        ...mapping,
        bkashLabel: bkashFolder,
        nagadLabel: nagadFolder,
        stripeLabel: stripeFolder,
      };

      setMapping(updatedMapping);
      saveLabelMappingPreferences(updatedMapping);

      await loadGmailLabelsAndMails();
      setMappingFeedback(
        lang === 'bn'
          ? 'Payments/bKash, Payments/Nagad এবং Payments/Stripe ফোল্ডার তৈরি ও ম্যাপ করা হয়েছে!'
          : 'Provisioned Payments/bKash, Payments/Nagad & Payments/Stripe folders in your Gmail!'
      );
      setTimeout(() => setMappingFeedback(null), 4000);
    } catch (err: any) {
      console.error('Error provisioning folders:', err);
      setMappingFeedback('Provisioning error: ' + err.message);
    } finally {
      setIsLoadingLabels(false);
    }
  };

  // Handle Create New Custom Label
  const handleCreateCustomLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newLabelName.trim()) return;

    setCreateLabelStatus('Creating label in Gmail...');
    try {
      const created = await createCustomGmailLabel(accessToken, {
        name: newLabelName.trim(),
        backgroundColor: selectedColor.bg,
        textColor: selectedColor.text,
      });

      // If user chose to assign to gateway immediately
      if (assignGatewayAfterCreate !== 'NONE') {
        const updated = { ...mapping };
        if (assignGatewayAfterCreate === 'BKASH') updated.bkashLabel = created.name;
        if (assignGatewayAfterCreate === 'NAGAD') updated.nagadLabel = created.name;
        if (assignGatewayAfterCreate === 'STRIPE') updated.stripeLabel = created.name;
        setMapping(updated);
        saveGatewayLabelMapping(assignGatewayAfterCreate, created.name);
        saveLabelMappingPreferences(updated);
      }

      setCreateLabelStatus(null);
      setNewLabelName('');
      setIsCreatingLabel(false);
      await loadGmailLabelsAndMails();

      setMappingFeedback(
        lang === 'bn'
          ? `ফোল্ডার "${created.name}" সফলভাবে তৈরি হয়েছে!`
          : `Custom folder "${created.name}" created and ready for receipts!`
      );
      setTimeout(() => setMappingFeedback(null), 3500);
    } catch (err: any) {
      setCreateLabelStatus(`Error: ${err.message}`);
    }
  };

  // Manual test send
  const handleManualTestSend = (e: React.FormEvent) => {
    e.preventDefault();
    const targetLabel =
      testGateway === 'BKASH'
        ? mapping.bkashLabel
        : testGateway === 'NAGAD'
        ? mapping.nagadLabel
        : mapping.stripeLabel;

    onRequestSendReceipt({
      toEmail: testEmail,
      amount: parseFloat(testAmount) || 100,
      currency: testGateway === 'STRIPE' ? 'USD' : 'BDT',
      trxId: 'TRX_TEST_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      invoiceNo: 'INV-TEST-' + Math.floor(1000 + Math.random() * 9000),
      gateway: testGateway,
      type: testGateway === 'STRIPE' ? 'PAYMENT_RECEIVED' : 'DISBURSEMENT',
      completedAt: new Date().toISOString(),
      label: targetLabel || 'Payments/Disbursed',
    });
  };

  // Filtered labels for display in explorer
  const displayedLabels = (
    labelFilterTab === 'user' ? userLabels : labelFilterTab === 'system' ? systemLabels : allLabels
  ).filter((l) => l.name.toLowerCase().includes(labelSearch.toLowerCase()));

  // Filtered labels for the selectable list inside the Settings interface
  const filteredSettingsLabels = (
    settingsTab === 'user' ? userLabels : settingsTab === 'system' ? systemLabels : allLabels
  ).filter((l) => l.name.toLowerCase().includes(settingsLabelSearch.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Auth Banner & Connection Status */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          {userPhoto ? (
            <img src={userPhoto} alt={userName} className="w-14 h-14 rounded-2xl ring-2 ring-indigo-500/40" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Mail className="w-7 h-7" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Gmail Dynamic Label &amp; Receipt Hub</h2>
              {isGmailConnected ? (
                <span className="text-[11px] bg-emerald-950 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-800 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  {lang === 'bn' ? 'সংযুক্ত' : 'Connected'}
                </span>
              ) : (
                <span className="text-[11px] bg-amber-950 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-800 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {lang === 'bn' ? 'সাইন-ইন প্রয়োজন' : 'Action Required'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isGmailConnected
                ? `Account: ${userEmail} (${userName || 'User'}) &bull; ${userLabels.length} Custom Folders &bull; Dynamic Label Mapping Active`
                : lang === 'bn'
                ? 'আপনার জিমেইল লেবেলগুলো স্বয়ংক্রিয়ভাবে ফেচ করে ডিসবার্সমেন্ট রসিদ নির্দিষ্ট ফোল্ডারে ম্যাপ করতে গুগল সাইন-ইন করুন।'
                : 'Connect your Google account to dynamically fetch all your Gmail folders and map disbursements to custom labels.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isGmailConnected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={loadGmailLabelsAndMails}
                disabled={isLoadingLabels}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition cursor-pointer"
                title="Refresh Gmail Labels"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLabels ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{lang === 'bn' ? 'রিফ্রেশ' : 'Sync Labels'}</span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'সাইন আউট' : 'Disconnect'}</span>
              </button>
            </div>
          ) : (
            <button onClick={onLogin} className="gsi-material-button cursor-pointer shadow-lg active:scale-95">
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">Sign in with Google</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* SETTINGS: PAYMENT GATEWAY TO GMAIL LABEL ASSIGNMENT */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
              <span>
                {lang === 'bn'
                  ? 'সেটিংস: পেমেন্ট গেটওয়ে ও জিমেইল লেবেল অ্যাসাইনমেন্ট'
                  : 'Settings: Gateway to Gmail Label Assignment'}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'bn'
                ? 'Stripe, bKash এবং Nagad-এর প্রতিটি পেমেন্টের জন্য নির্দিষ্ট জিমেইল লেবেল নির্বাচন করুন (localStorage-এ সংরক্ষিত)।'
                : 'Select and persist which Gmail label to assign to specific gateways (Stripe, bKash, and Nagad) using localStorage.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isGmailConnected && (
              <button
                onClick={handleQuickProvisionFolders}
                disabled={isLoadingLabels}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-700/60 hover:bg-indigo-900 text-xs font-semibold transition cursor-pointer"
                title="Auto-create Payments/bKash, Payments/Nagad, and Payments/Stripe labels"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? '১-ক্লিক ফোল্ডার তৈরি' : '1-Click Standard Folders'}</span>
              </button>
            )}

            <button
              onClick={() => setIsCreatingLabel(true)}
              disabled={!accessToken}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? '+ নতুন কাস্টম ফোল্ডার' : '+ Create Custom Folder'}</span>
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {mappingFeedback && (
          <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{mappingFeedback}</span>
          </div>
        )}

        {/* Current Saved Mapping Quick Overview (Immediate feedback on initial load via read-only input fields) */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <FolderTree className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-semibold">
                {lang === 'bn' ? 'বর্তমান সংরক্ষিত লেবেল কনফিগারেশন (localStorage):' : 'Current Saved Label Configuration (localStorage):'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              Immediate Feedback &bull; Auto-Synced
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-300 shrink-0">Stripe:</span>
              <input
                type="text"
                readOnly
                value={gatewayMappings.STRIPE}
                className="w-full bg-transparent text-xs font-mono text-cyan-300 outline-none cursor-default select-all"
                title="Current saved Stripe Gmail label (Read-only)"
              />
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono bg-slate-800 px-1 py-0.5 rounded border border-slate-700">RO</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-300 shrink-0">bKash:</span>
              <input
                type="text"
                readOnly
                value={gatewayMappings.BKASH}
                className="w-full bg-transparent text-xs font-mono text-pink-300 outline-none cursor-default select-all"
                title="Current saved bKash Gmail label (Read-only)"
              />
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono bg-slate-800 px-1 py-0.5 rounded border border-slate-700">RO</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-300 shrink-0">Nagad:</span>
              <input
                type="text"
                readOnly
                value={gatewayMappings.NAGAD}
                className="w-full bg-transparent text-xs font-mono text-orange-300 outline-none cursor-default select-all"
                title="Current saved Nagad Gmail label (Read-only)"
              />
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono bg-slate-800 px-1 py-0.5 rounded border border-slate-700">RO</span>
            </div>
          </div>
        </div>

        {/* Mapping Controls Grid: Stripe, bKash, Nagad */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Stripe Card Mapping */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="font-bold text-xs text-white">Stripe Card Receipts</span>
              </div>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800/60">
                Gateway: STRIPE
              </span>
            </div>

            {/* Read-only field displaying existing configuration */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{lang === 'bn' ? 'বর্তমান সংরক্ষিত লেবেল (রিড-অনলি):' : 'Current Saved Mapping (Read-Only):'}</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/90 px-1.5 py-0.5 rounded border border-emerald-800/60">
                  Active
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={gatewayMappings.STRIPE}
                  className="w-full bg-slate-900/90 border border-slate-700/90 rounded-lg px-3 py-2 pr-20 text-xs font-mono text-cyan-300 cursor-default select-all focus:outline-none focus:border-indigo-500 shadow-inner"
                  title="Existing saved Stripe Gmail label configuration in localStorage"
                />
                <span className="absolute right-2 top-2 text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  Read-Only
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {lang === 'bn'
                  ? 'এই গেটওয়ের রসিদ স্বয়ংক্রিয়ভাবে এই জিমেইল ফোল্ডারে যাবে।'
                  : 'Receipts for Stripe are automatically tagged to this Gmail folder.'}
              </p>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                <span>{lang === 'bn' ? 'ম্যাপিং পরিবর্তন করুন:' : 'Change Assigned Gmail Label:'}</span>
                <span className="text-[10px] text-slate-500">
                  {isLoadingLabels ? 'Fetching...' : `${userLabels.length} custom folders`}
                </span>
              </label>
              <select
                value={mapping.stripeLabel}
                onChange={(e) => handleGatewayMappingChange('STRIPE', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <optgroup label="User Custom Folders">
                  {userLabels.map((l) => (
                    <option key={l.id} value={l.name}>
                      📁 {l.name}
                    </option>
                  ))}
                  {!userLabels.some((l) => l.name === 'Payments/Received') && (
                    <option value="Payments/Received">Payments/Received</option>
                  )}
                  {!userLabels.some((l) => l.name === 'Payments/Stripe') && (
                    <option value="Payments/Stripe">Payments/Stripe (Auto-Create)</option>
                  )}
                </optgroup>
                <optgroup label="System Labels">
                  {systemLabels.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span className="flex items-center gap-1 font-mono">
                <ArrowRight className="w-3 h-3 text-indigo-400" />
                <span>Existing Config: <strong className="text-white">{gatewayMappings.STRIPE}</strong></span>
              </span>
              <span className="text-[9px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                <span>Saved in localStorage</span>
              </span>
            </div>
          </div>

          {/* bKash Mapping Card */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                <span className="font-bold text-xs text-white">bKash B2C Payouts</span>
              </div>
              <span className="text-[10px] font-mono text-pink-400 bg-pink-950 px-1.5 py-0.5 rounded border border-pink-800/60">
                Gateway: BKASH
              </span>
            </div>

            {/* Read-only field displaying existing configuration */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-pink-400" />
                  <span>{lang === 'bn' ? 'বর্তমান সংরক্ষিত লেবেল (রিড-অনলি):' : 'Current Saved Mapping (Read-Only):'}</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/90 px-1.5 py-0.5 rounded border border-emerald-800/60">
                  Active
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={gatewayMappings.BKASH}
                  className="w-full bg-slate-900/90 border border-slate-700/90 rounded-lg px-3 py-2 pr-20 text-xs font-mono text-pink-300 cursor-default select-all focus:outline-none focus:border-pink-500 shadow-inner"
                  title="Existing saved bKash Gmail label configuration in localStorage"
                />
                <span className="absolute right-2 top-2 text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  Read-Only
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {lang === 'bn'
                  ? 'বিকাশ ডিসবার্সমেন্ট রসিদ এই জিমেইল ফোল্ডারে স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে।'
                  : 'bKash disbursement receipts are automatically tagged to this Gmail folder.'}
              </p>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                <span>{lang === 'bn' ? 'ম্যাপিং পরিবর্তন করুন:' : 'Change Assigned Gmail Label:'}</span>
                <span className="text-[10px] text-slate-500">
                  {isLoadingLabels ? 'Fetching...' : `${userLabels.length} custom folders`}
                </span>
              </label>
              <select
                value={mapping.bkashLabel}
                onChange={(e) => handleGatewayMappingChange('BKASH', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
              >
                <optgroup label="User Custom Folders">
                  {userLabels.map((l) => (
                    <option key={l.id} value={l.name}>
                      📁 {l.name}
                    </option>
                  ))}
                  {!userLabels.some((l) => l.name === 'Payments/bKash') && (
                    <option value="Payments/bKash">Payments/bKash (Auto-Create)</option>
                  )}
                  {!userLabels.some((l) => l.name === 'Payments/Disbursed') && (
                    <option value="Payments/Disbursed">Payments/Disbursed</option>
                  )}
                </optgroup>
                <optgroup label="System Labels">
                  {systemLabels.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span className="flex items-center gap-1 font-mono">
                <ArrowRight className="w-3 h-3 text-pink-400" />
                <span>Existing Config: <strong className="text-white">{gatewayMappings.BKASH}</strong></span>
              </span>
              <span className="text-[9px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                <span>Saved in localStorage</span>
              </span>
            </div>
          </div>

          {/* Nagad Mapping Card */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="font-bold text-xs text-white">Nagad B2C Payouts</span>
              </div>
              <span className="text-[10px] font-mono text-orange-400 bg-orange-950 px-1.5 py-0.5 rounded border border-orange-800/60">
                Gateway: NAGAD
              </span>
            </div>

            {/* Read-only field displaying existing configuration */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange-400" />
                  <span>{lang === 'bn' ? 'বর্তমান সংরক্ষিত লেবেল (রিড-অনলি):' : 'Current Saved Mapping (Read-Only):'}</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/90 px-1.5 py-0.5 rounded border border-emerald-800/60">
                  Active
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={gatewayMappings.NAGAD}
                  className="w-full bg-slate-900/90 border border-slate-700/90 rounded-lg px-3 py-2 pr-20 text-xs font-mono text-orange-300 cursor-default select-all focus:outline-none focus:border-orange-500 shadow-inner"
                  title="Existing saved Nagad Gmail label configuration in localStorage"
                />
                <span className="absolute right-2 top-2 text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  Read-Only
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {lang === 'bn'
                  ? 'নগদ ডিসবার্সমেন্ট রসিদ এই জিমেইল ফোল্ডারে স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে।'
                  : 'Nagad disbursement receipts are automatically tagged to this Gmail folder.'}
              </p>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                <span>{lang === 'bn' ? 'ম্যাপিং পরিবর্তন করুন:' : 'Change Assigned Gmail Folder:'}</span>
                <span className="text-[10px] text-slate-500">
                  {isLoadingLabels ? 'Fetching...' : `${userLabels.length} custom folders`}
                </span>
              </label>
              <select
                value={mapping.nagadLabel}
                onChange={(e) => handleGatewayMappingChange('NAGAD', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <optgroup label="User Custom Folders">
                  {userLabels.map((l) => (
                    <option key={l.id} value={l.name}>
                      📁 {l.name}
                    </option>
                  ))}
                  {!userLabels.some((l) => l.name === 'Payments/Nagad') && (
                    <option value="Payments/Nagad">Payments/Nagad (Auto-Create)</option>
                  )}
                  {!userLabels.some((l) => l.name === 'Payments/Disbursed') && (
                    <option value="Payments/Disbursed">Payments/Disbursed</option>
                  )}
                </optgroup>
                <optgroup label="System Labels">
                  {systemLabels.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span className="flex items-center gap-1 font-mono">
                <ArrowRight className="w-3 h-3 text-orange-400" />
                <span>Existing Config: <strong className="text-white">{gatewayMappings.NAGAD}</strong></span>
              </span>
              <span className="text-[9px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                <span>Saved in localStorage</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Selectable Gmail Labels List for Interactive Gateway Mapping */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-950/85 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" />
                <h4 className="font-bold text-xs sm:text-sm text-white">
                  {lang === 'bn' ? 'জিমেইল লেবেল নির্বাচন তালিকা (ডাইনামিক ম্যাপিং)' : 'Dynamic Label Picker: Select a Gmail Label'}
                </h4>
                {isLoadingLabels ? (
                  <span className="flex items-center gap-1.5 text-[10px] text-indigo-400 bg-indigo-950/90 px-2 py-0.5 rounded-full border border-indigo-800/80 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Fetching labels...</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/60 font-mono">
                    {allLabels.length} labels ready
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {lang === 'bn'
                  ? 'নিচের যেকোনো জিমেইল ফোল্ডারে ক্লিক করে সরাসরি নির্বাচিত গেটওয়েতে অ্যাসাইন করুন (স্বয়ংক্রিয়ভাবে সংরক্ষিত)।'
                  : 'Click any Gmail label row below to dynamically map it to the active gateway and persist in localStorage.'}
              </p>
            </div>

            {/* Target Gateway Selector */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto">
              <span className="text-[10px] font-semibold text-slate-400 px-2 uppercase tracking-wider">
                {lang === 'bn' ? 'টার্গেট:' : 'Map To:'}
              </span>
              <button
                type="button"
                onClick={() => setSettingsSelectedGateway('STRIPE')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  settingsSelectedGateway === 'STRIPE'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span>Stripe</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSelectedGateway('BKASH')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  settingsSelectedGateway === 'BKASH'
                    ? 'bg-pink-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-pink-400" />
                <span>bKash</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSelectedGateway('NAGAD')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  settingsSelectedGateway === 'NAGAD'
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                <span>Nagad</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-900">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={settingsLabelSearch}
                onChange={(e) => setSettingsLabelSearch(e.target.value)}
                placeholder="Filter Gmail labels..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSettingsTab('all')}
                  className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                    settingsTab === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({allLabels.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab('user')}
                  className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                    settingsTab === 'user' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Custom ({userLabels.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab('system')}
                  className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                    settingsTab === 'system' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  System ({systemLabels.length})
                </button>
              </div>

              {accessToken && (
                <button
                  type="button"
                  onClick={() => loadGmailLabelsAndMails()}
                  disabled={isLoadingLabels}
                  className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer disabled:opacity-50"
                  title="Reload labels from Gmail"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLabels ? 'animate-spin text-indigo-400' : ''}`} />
                </button>
              )}
            </div>
          </div>

          {/* Selectable List Items */}
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-900">
            {isLoadingLabels && allLabels.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                <span>Fetching Gmail labels upon mount...</span>
              </div>
            ) : filteredSettingsLabels.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No matching Gmail labels found.
              </div>
            ) : (
              filteredSettingsLabels.map((lbl) => {
                const isSelectedForActive = gatewayMappings[settingsSelectedGateway] === lbl.name;
                const isStripe = gatewayMappings.STRIPE === lbl.name;
                const isBkash = gatewayMappings.BKASH === lbl.name;
                const isNagad = gatewayMappings.NAGAD === lbl.name;

                return (
                  <div
                    key={lbl.id}
                    onClick={() => handleGatewayMappingChange(settingsSelectedGateway, lbl.name)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                      isSelectedForActive
                        ? settingsSelectedGateway === 'STRIPE'
                          ? 'bg-indigo-950/60 border-indigo-500/80 ring-1 ring-indigo-500/50'
                          : settingsSelectedGateway === 'BKASH'
                          ? 'bg-pink-950/60 border-pink-500/80 ring-1 ring-pink-500/50'
                          : 'bg-orange-950/60 border-orange-500/80 ring-1 ring-orange-500/50'
                        : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelectedForActive
                            ? settingsSelectedGateway === 'STRIPE'
                              ? 'border-indigo-500 bg-indigo-600 text-white'
                              : settingsSelectedGateway === 'BKASH'
                              ? 'border-pink-500 bg-pink-600 text-white'
                              : 'border-orange-500 bg-orange-600 text-white'
                            : 'border-slate-600 bg-slate-950'
                        }`}
                      >
                        {isSelectedForActive && <Check className="w-2.5 h-2.5" />}
                      </div>

                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: lbl.color?.backgroundColor || '#6366f1' }}
                      />

                      <div className="min-w-0">
                        <span className="font-mono font-medium text-white truncate block">
                          {lbl.name}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {lbl.type === 'user' ? 'Custom User Folder' : 'System Label'} &bull; {lbl.messagesTotal ?? 0} msgs
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isStripe && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                          Stripe
                        </span>
                      )}
                      {isBkash && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-pink-950 text-pink-300 border border-pink-800">
                          bKash
                        </span>
                      )}
                      {isNagad && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-800">
                          Nagad
                        </span>
                      )}
                      {isSelectedForActive && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-800/80">
                          Active Target
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Save Mapping Button & Options */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
            <input
              type="checkbox"
              checked={mapping.autoApplyLabels}
              onChange={(e) => setMapping({ ...mapping, autoApplyLabels: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700"
            />
            <span>
              {lang === 'bn'
                ? 'রসিদ পাঠানোর পর স্বয়ংক্রিয়ভাবে জিমেইল লেবেল ট্যাগ করুন (localStorage-এ সংরক্ষিত)'
                : 'Auto-tag receipts to mapped labels upon dispatch (persisted in localStorage)'}
            </span>
          </label>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleResetMappings}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              title="Reset all gateway mappings to default system folders (clearGatewayMappings)"
            >
              {lang === 'bn' ? 'ডিফল্টে রিসেট' : 'Reset to Defaults'}
            </button>

            <button
              onClick={handleSaveMapping}
              disabled={isSavingMapping}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSavingMapping ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{lang === 'bn' ? 'ম্যাপিং সংরক্ষণ করুন' : 'Save Gateway Mappings'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CREATE NEW CUSTOM FOLDER MODAL */}
      {isCreatingLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100 relative">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
              <FolderPlus className="w-5 h-5 text-indigo-400" />
              <span>{lang === 'bn' ? 'নতুন জিমেইল কাস্টম ফোল্ডার তৈরি' : 'Create Custom Gmail Folder / Label'}</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {lang === 'bn'
                ? 'নেস্টেড সাবফোল্ডার তৈরি করতে স্ল্যাশ (/) ব্যবহার করুন (যেমন: Payments/Affiliate-Payouts)'
                : 'Supports nested sub-folders using forward slashes (e.g. Payments/Affiliate-Payouts).'}
            </p>

            <form onSubmit={handleCreateCustomLabel} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {lang === 'bn' ? 'ফোল্ডারের নাম (Folder Name):' : 'Folder / Label Name:'}
                </label>
                <input
                  type="text"
                  required
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Payments/Q4-Disbursements"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Color swatch selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{lang === 'bn' ? 'লেবেল কালার (Gmail Color):' : 'Folder Color Badge:'}</span>
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {GMAIL_PALETTE_COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition border ${
                        selectedColor.name === c.name
                          ? 'ring-2 ring-white scale-110 border-white'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.bg }}
                      title={c.name}
                    >
                      {selectedColor.name === c.name && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Map immediately after creation */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {lang === 'bn' ? 'তৈরির পর গেটওয়েতে ম্যাপ করুন:' : 'Assign to Gateway immediately:'}
                </label>
                <select
                  value={assignGatewayAfterCreate}
                  onChange={(e) => setAssignGatewayAfterCreate(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                >
                  <option value="NONE">{lang === 'bn' ? 'ম্যাপ করবেন না (শুধু তৈরি করুন)' : 'Do not assign yet (create only)'}</option>
                  <option value="BKASH">🟣 Assign to bKash B2C Payouts</option>
                  <option value="NAGAD">🟠 Assign to Nagad B2C Payouts</option>
                  <option value="STRIPE">🔵 Assign to Stripe Card Receipts</option>
                </select>
              </div>

              {createLabelStatus && (
                <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-800 text-indigo-300 font-mono text-[11px]">
                  {createLabelStatus}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreatingLabel(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md cursor-pointer"
                >
                  Create in Gmail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DYNAMIC GMAIL LABELS & FOLDERS EXPLORER */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                {lang === 'bn' ? 'ব্যবহারকারীর বিদ্যমান জিমেইল ফোল্ডারসমূহ' : 'Available Gmail Folders & Labels'}
              </h3>
              <p className="text-xs text-slate-400">
                {userLabels.length} {lang === 'bn' ? 'কাস্টম ফোল্ডার' : 'Custom user folders'} &bull;{' '}
                {allLabels.length} {lang === 'bn' ? 'মোট লেবেল' : 'Total labels found in account'}
              </p>
            </div>
          </div>

          {/* Search & Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={labelSearch}
                onChange={(e) => setLabelSearch(e.target.value)}
                placeholder="Search folders..."
                className="bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40 sm:w-48"
              />
            </div>

            <div className="flex bg-slate-950 rounded-xl p-0.5 border border-slate-800 text-xs">
              <button
                onClick={() => setLabelFilterTab('user')}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  labelFilterTab === 'user' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Custom ({userLabels.length})
              </button>
              <button
                onClick={() => setLabelFilterTab('all')}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  labelFilterTab === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({allLabels.length})
              </button>
              <button
                onClick={() => setLabelFilterTab('system')}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  labelFilterTab === 'system' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                System
              </button>
            </div>
          </div>
        </div>

        {/* Labels Grid */}
        {isLoadingLabels ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span>Fetching live Gmail labels and message metadata...</span>
          </div>
        ) : displayedLabels.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
            {isGmailConnected
              ? 'No matching Gmail labels found.'
              : 'Connect your Google account above to view and manage your Gmail folders.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedLabels.map((lbl) => {
              const isBkashMapped = mapping.bkashLabel === lbl.name;
              const isNagadMapped = mapping.nagadLabel === lbl.name;
              const isStripeMapped = mapping.stripeLabel === lbl.name;

              return (
                <div
                  key={lbl.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: lbl.color?.backgroundColor || '#64748b' }}
                      />
                      <div>
                        <div className="font-semibold text-white font-mono break-all">{lbl.name}</div>
                        <div className="text-[10px] text-slate-500 capitalize">{lbl.type} folder</div>
                      </div>
                    </div>

                    <a
                      href={`https://mail.google.com/mail/u/0/#label/${encodeURIComponent(lbl.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-slate-300 transition p-1"
                      title="Open label in Gmail web"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Messages Count & Mappings badges */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[11px]">
                    <div className="text-slate-400">
                      <span>{lbl.messagesTotal ?? 0} msgs</span>
                      {lbl.messagesUnread ? (
                        <span className="ml-1.5 text-indigo-400 font-semibold font-mono">
                          ({lbl.messagesUnread} unread)
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1">
                      {isBkashMapped && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-950 text-pink-300 border border-pink-800">
                          bKash
                        </span>
                      )}
                      {isNagadMapped && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-300 border border-orange-800">
                          Nagad
                        </span>
                      )}
                      {isStripeMapped && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                          Stripe
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 1-Click Gateway Mapping Actions */}
                  <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-900/80 text-[10px]">
                    <span className="text-slate-500 font-medium">Assign to:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleGatewayMappingChange('STRIPE', lbl.name)}
                        className={`px-2 py-0.5 rounded border transition cursor-pointer font-medium ${
                          isStripeMapped
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-indigo-500 hover:text-indigo-300'
                        }`}
                        title={`Assign ${lbl.name} to Stripe receipts`}
                      >
                        Stripe
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGatewayMappingChange('BKASH', lbl.name)}
                        className={`px-2 py-0.5 rounded border transition cursor-pointer font-medium ${
                          isBkashMapped
                            ? 'bg-pink-600 text-white border-pink-500'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-pink-500 hover:text-pink-300'
                        }`}
                        title={`Assign ${lbl.name} to bKash payouts`}
                      >
                        bKash
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGatewayMappingChange('NAGAD', lbl.name)}
                        className={`px-2 py-0.5 rounded border transition cursor-pointer font-medium ${
                          isNagadMapped
                            ? 'bg-orange-600 text-white border-orange-500'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-orange-500 hover:text-orange-300'
                        }`}
                        title={`Assign ${lbl.name} to Nagad payouts`}
                      >
                        Nagad
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MANUAL TEST RECEIPT SENDER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-400" />
            <span>{lang === 'bn' ? 'টেস্ট রসিদ প্রেরণ (Mapped Folders Test)' : 'Test Mapped Receipt Dispatch'}</span>
          </h3>

          <form onSubmit={handleManualTestSend} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Recipient Email:</label>
              <input
                type="email"
                required
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Gateway Template:</label>
                <select
                  value={testGateway}
                  onChange={(e) => setTestGateway(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none"
                >
                  <option value="BKASH">bKash B2C ({mapping.bkashLabel})</option>
                  <option value="NAGAD">Nagad B2C ({mapping.nagadLabel})</option>
                  <option value="STRIPE">Stripe ({mapping.stripeLabel})</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Amount:</label>
                <input
                  type="number"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                {showPreview ? 'Hide HTML Preview' : 'Show HTML Preview'}
              </button>
              <button
                type="submit"
                disabled={!accessToken}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dispatch Email</span>
              </button>
            </div>
          </form>
        </div>

        {/* Recent Sent Receipt Emails Audit */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Inbox className="w-4 h-4 text-cyan-400" />
              <span>{lang === 'bn' ? 'সম্প্রতি প্রেরিত পেমেন্ট রসিদ অডিট' : 'Recent Gmail Payment Receipts'}</span>
            </h3>
            <span className="text-[11px] text-slate-400">Live Gmail API</span>
          </div>

          {receiptEmails.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              {isGmailConnected
                ? 'No recent payment receipts in Gmail query yet. Send one above!'
                : 'Connect your Google account above to inspect your live Gmail receipt delivery history.'}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {receiptEmails.map((msg) => (
                <div
                  key={msg.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between gap-1 text-xs"
                >
                  <div className="font-semibold text-white truncate">{msg.subject || 'Payment Receipt'}</div>
                  <div className="text-[11px] text-slate-400 truncate">{msg.snippet}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span className="font-mono text-indigo-300">{msg.to || 'recipient'}</span>
                    <span>{msg.date || 'Recent'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* HTML Receipt Preview Expand */}
      {showPreview && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="text-xs font-semibold text-slate-300">Live HTML Template Preview</div>
          <div
            className="p-4 rounded-xl bg-slate-950 border border-slate-800 max-h-80 overflow-y-auto"
            dangerouslySetInnerHTML={{
              __html: buildReceiptHtml({
                toEmail: testEmail,
                amount: parseFloat(testAmount) || 100,
                currency: testGateway === 'STRIPE' ? 'USD' : 'BDT',
                trxId: 'TRX_SAMPLE_99182',
                invoiceNo: 'INV-SAMPLE-2026',
                gateway: testGateway,
                type: 'DISBURSEMENT',
                completedAt: new Date().toISOString(),
                label:
                  testGateway === 'BKASH'
                    ? mapping.bkashLabel
                    : testGateway === 'NAGAD'
                    ? mapping.nagadLabel
                    : mapping.stripeLabel,
              }),
            }}
          />
        </div>
      )}
    </div>
  );
};
