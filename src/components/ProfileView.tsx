import * as d3 from "d3";
import {
	Activity,
	Award,
	Bookmark,
	Camera,
	Check,
	Copy,
	CreditCard,
	FileText,
	Gift,
	Heart,
	History,
	Home,
	Library,
	Lock,
	MapPin,
	Phone,
	RotateCcw,
	Share2,
	Shield,
	ShieldAlert,
	ShieldCheck,
	Trash2,
	User,
	Users,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMealDirect, validateAvatarFile } from "../store";
import {
	COUNTRIES,
	parseStoredPhone,
	validateCountryPhone,
} from "../utils/countries";
import { computeSpendHistory } from "../utils/helpers";
import { AppShell, Currency, GlassPanel } from "./CommonUI";

// In-app legal & security copy. Shown in a modal instead of linking off to a
// separate website, so users never leave the app to read policy text.
const LEGAL_CONTENT: Record<string, { title: string; body: string }> = {
	terms: {
		title: "Terms of Service",
		body: "By using Meal Direct you agree to order in good faith, provide accurate delivery details, and pay for confirmed orders. Meal Direct connects you with campus vendors and dispatch riders; meal quality and timing are the vendor's responsibility, though we help mediate disputes. Orders may be cancelled or refunded through the support flow when a vendor cannot fulfil them. We may update these terms and will notify you of material changes in the app.",
	},
	privacy: {
		title: "Privacy Policy",
		body: "We collect only what we need to run your orders: your name, phone number, campus, delivery locations, and order history. This data is used to process orders, personalise your experience, and improve the service. We never sell your personal data, and we only share details with vendors and riders to the extent needed to complete a delivery. You can request account and data deletion at any time from this screen.",
	},
	security: {
		title: "Data Protection & Security",
		body: "Your payments and personal data are encrypted in transit and secured on our servers. Access to your account is protected by your login, and active sessions can be ended by signing out. If you suspect unauthorised access, sign out on all devices and contact support immediately. You control your data: you can update your profile details here, or permanently delete your account and all associated data using the option below.",
	},
	community: {
		title: "Community Guidelines",
		body: "Meal Direct is a shared campus community. Treat vendors, riders, and fellow students with respect. Do not place fraudulent or prank orders, harass dispatch riders, or misuse the support and escalation tools. Accounts that abuse the platform may be suspended. Report any unsafe or abusive behaviour through the support channel so we can act on it.",
	},
};

export const ProfileView: React.FC = () => {
	const {
		user,
		updateProfile,
		uploadAvatar,
		savedLocationIds,
		toggleSaveLocation,
		orders,
		reorderOrder,
		navigateTo,
        signOut,
		registerDeviceToken,
		unregisterDeviceToken,
		campuses: CAMPUSES,
		locations: PRESET_LOCATIONS,
		vendors: VENDORS,
		menuItems: MENU_ITEMS,
		referral,
		fetchReferral
	} = useMealDirect();

	// Referral / invite state. Loaded once on mount; `copied` drives the button feedback.
	const [copied, setCopied] = useState<null | 'code' | 'link'>(null);
	// Track the fetch itself so a failed load doesn't sit on "Loading…" forever —
	// distinguish in-flight (loading) from a genuine failure (error + retry).
	const [referralStatus, setReferralStatus] = useState<'loading' | 'ready' | 'error'>('loading');
	const loadReferral = async () => {
		setReferralStatus('loading');
		const r = await fetchReferral();
		setReferralStatus(r ? 'ready' : 'error');
	};
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const r = await fetchReferral();
			if (!cancelled) setReferralStatus(r ? 'ready' : 'error');
		})();
		return () => { cancelled = true; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const referralLink = referral
		? `${window.location.origin}/?ref=${referral.code}`
		: '';

	const handleCopy = async (value: string, which: 'code' | 'link') => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(which);
			setTimeout(() => setCopied(null), 1800);
		} catch {
			setMsg({ type: 'error', txt: 'Could not copy. Please copy it manually.' });
		}
	};

	const handleShare = async () => {
		if (!referral) return;
		const shareData = {
			title: 'Meal Direct',
			text: `Join me on Meal Direct and order hot campus meals! Use my referral code ${referral.code}.`,
			url: referralLink
		};
		try {
			if (navigator.share) {
				await navigator.share(shareData);
			} else {
				await handleCopy(referralLink, 'link');
			}
		} catch {
			/* user dismissed the share sheet — no-op */
		}
	};

	// Real spending/nutrition tracker, derived from the customer's own orders.
	const spendHistory = useMemo(
		() => computeSpendHistory(orders, MENU_ITEMS),
		[orders, MENU_ITEMS],
	);

	// If user is null, fallback values
	const [fullName, setFullName] = useState(user?.fullName || "");

	// Push notifications. "Enabled" must reflect a real, live push subscription —
	// not merely that the user once granted notification permission. We confirm
	// the subscription on mount below.
	const [pushState, setPushState] = useState<'idle' | 'loading' | 'enabled' | 'unavailable'>('idle');
	// Whether web push is even configured in this build. If the VAPID key wasn't
	// injected at build time, subscription can never succeed — surface that
	// explicitly instead of letting the toggle silently no-op.
	const pushConfigured = Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				if (!('serviceWorker' in navigator) || typeof Notification === 'undefined') {
					return;
				}
				if (Notification.permission !== 'granted') return;
				// Enabled only if permission is granted AND we hold an FCM token we sent to
				// the backend. Firebase owns the underlying PushSubscription internally, so
				// md_device_token is our source of truth for "registered on this browser".
				if (!cancelled && localStorage.getItem('md_device_token')) {
					setPushState('enabled');
				}
			} catch {
				/* leave as idle — user can re-enable */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);
	const handleEnablePush = async () => {
		setPushState('loading');
		const ok = await registerDeviceToken();
		setPushState(ok ? 'enabled' : 'unavailable');
	};
	const handleDisablePush = async () => {
		setPushState('loading');
		const ok = await unregisterDeviceToken();
		setPushState(ok ? 'idle' : 'unavailable');
	};

	// Parse existing phone number or fallback to default Nigeria format
	const parsed = parseStoredPhone(user?.phone || "08012345678");
	const [selectedCountry, setSelectedCountry] = useState(parsed.country);
	const [localPhone, setLocalPhone] = useState(parsed.localNumber);

	const [selectedCampus, setSelectedCampus] = useState(
		user?.campusId || CAMPUSES[0]?.id || "",
	);
	const [selectedLocation, setSelectedLocation] = useState(
		user?.defaultLocationId || "",
	);
	const [isSaving, setIsSaving] = useState(false);
	const [isAvatarUploading, setIsAvatarUploading] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [legalModal, setLegalModal] = useState<{ title: string; body: string } | null>(null);
	const [msg, setMsg] = useState<{
		type: "success" | "error";
		txt: string;
	} | null>(null);

	// D3 ref & state
	const svgRef = useRef<SVGSVGElement | null>(null);
	const avatarInputRef = useRef<HTMLInputElement | null>(null);
	const [selectedWeek, setSelectedWeek] = useState<number>(0);
	// Default selection to the most recent week whenever the data changes.
	useEffect(() => {
		setSelectedWeek(Math.max(0, spendHistory.length - 1));
	}, [spendHistory.length]);
	const safeWeek = Math.min(selectedWeek, Math.max(0, spendHistory.length - 1));
	const hasSpendData = spendHistory.length > 0;

	// Filter locations
	const filteredLocs = PRESET_LOCATIONS.filter(
		(loc) => loc.campusId === selectedCampus,
	);
	// Zones are backend-defined (loc.zone) and vary per campus, so derive the
	// groups from the data instead of hardcoding "Zone A"/"Zone B" — hardcoded
	// literals never match a campus whose zones are named differently, which left
	// the zone headers rendering with no location cards under them.
	const zoneNames = Array.from(new Set(filteredLocs.map((loc) => loc.zone)));
	const zoneGroups = zoneNames.map((zoneName) => ({
		zoneName,
		hostels: filteredLocs.filter(
			(loc) => loc.zone === zoneName && loc.type === "Hostel",
		),
		depts: filteredLocs.filter(
			(loc) => loc.zone === zoneName && loc.type === "Department",
		),
	}));

	const handleSaveProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		setMsg(null);

		if (!fullName.trim()) {
			setMsg({
				type: "error",
				txt: "Please specify a valid name for courier contact.",
			});
			return;
		}

		if (!validateCountryPhone(selectedCountry, localPhone)) {
			setMsg({
				type: "error",
				txt: `Please provide a valid phone number for ${selectedCountry.name}. e.g. ${selectedCountry.example}`,
			});
			return;
		}

		if (!selectedLocation) {
			setMsg({
				type: "error",
				txt: "Please select your hostel or department as your delivery location.",
			});
			return;
		}

		setIsSaving(true);

		const finalPhoneNumber =
			selectedCountry.code === "OTHER"
				? localPhone.trim()
				: `${selectedCountry.dialCode}${localPhone.trim().replace(/^0/, "")}`;

		try {
			await updateProfile(
				fullName,
				finalPhoneNumber,
				selectedCampus,
				selectedLocation,
			);
			setMsg({
				type: "success",
				txt: "Your profile and default delivery location were saved.",
			});
		} catch (err: any) {
			setMsg({
				type: "error",
				txt: err?.message || "Could not save your profile. Please try again.",
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;

		const validationError = validateAvatarFile(file);
		if (validationError) {
			setMsg({ type: "error", txt: validationError });
			return;
		}

		setMsg(null);
		setIsAvatarUploading(true);
		try {
			await uploadAvatar(file);
			setMsg({ type: "success", txt: "Your profile photo was updated." });
		} catch (err: any) {
			setMsg({
				type: "error",
				txt: err?.message || "Could not upload your profile photo. Please try again.",
			});
		} finally {
			setIsAvatarUploading(false);
		}
	};

	// Render D3 chart
	useEffect(() => {
		if (!svgRef.current) return;

		const d3Container = d3.select(svgRef.current);
		d3Container.selectAll("*").remove();
		if (!hasSpendData) return;

		const margin = { top: 30, right: 15, bottom: 35, left: 55 };
		const width = 500;
		const height = 230;

		const svg = d3Container
			.attr("viewBox", `0 0 ${width} ${height}`)
			.attr("width", "100%")
			.attr("height", "100%");

		const chartWidth = width - margin.left - margin.right;
		const chartHeight = height - margin.top - margin.bottom;

		const g = svg
			.append("g")
			.attr("transform", `translate(${margin.left},${margin.top})`);

		// X scale
		const xScale = d3
			.scaleBand()
			.domain(spendHistory.map((d) => d.weekLabel))
			.range([0, chartWidth])
			.padding(0.4);

		// Y scale (dynamic to the customer's actual spend)
		const maxSpend = d3.max(spendHistory, (d) => d.spendAmount) || 0;
		const yScale = d3
			.scaleLinear()
			.domain([0, Math.max(maxSpend, 1000)])
			.nice()
			.range([chartHeight, 0]);

		// Grid lines
		g.append("g")
			.attr("class", "grid")
			.style("stroke-dasharray", "3,3")
			.style("opacity", 0.15)
			.call(
				d3
					.axisLeft(yScale)
					.tickSize(-chartWidth)
					.tickFormat(() => ""),
			);

		// X Axis
		g.append("g")
			.attr("transform", `translate(0,${chartHeight})`)
			.call(d3.axisBottom(xScale).tickSize(5))
			.attr("font-size", "10px")
			.attr("color", "#374151")
			.selectAll("text")
			.style("font-family", "JetBrains Mono, monospace")
			.style("font-weight", "500")
			.style("fill", "#4B5563");

		// Y Axis
		g.append("g")
			.call(
				d3
					.axisLeft(yScale)
					.ticks(5)
					.tickFormat((d) => `₦${(Number(d)).toLocaleString()}`),
			)
			.attr("font-size", "10px")
			.attr("color", "#374151")
			.selectAll("text")
			.style("font-family", "JetBrains Mono, monospace")
			.style("font-weight", "500")
			.style("fill", "#4B5563");

		// Drawing bars
		const bars = g
			.selectAll(".bar")
			.data(spendHistory)
			.enter()
			.append("rect")
			.attr("class", "bar")
			.attr("x", (d) => xScale(d.weekLabel) || 0)
			.attr("y", (d) => yScale(d.spendAmount))
			.attr("width", xScale.bandwidth())
			.attr("height", (d) => chartHeight - yScale(d.spendAmount))
			.attr("rx", 6)
			.attr("fill", (d, i) => (i === safeWeek ? "#10b981" : "#111827"))
			.attr("opacity", (d, i) => (i === safeWeek ? 1.0 : 0.6))
			.style("cursor", "pointer")
			.style("transition", "all 0.2s ease");

		// Bar Labels
		g.selectAll(".label")
			.data(spendHistory)
			.enter()
			.append("text")
			.attr("class", "label")
			.attr("x", (d) => (xScale(d.weekLabel) || 0) + xScale.bandwidth() / 2)
			.attr("y", (d) => yScale(d.spendAmount) - 8)
			.attr("text-anchor", "middle")
			.text((d) => `₦${(d.spendAmount).toLocaleString()}`)
			.style("font-size", "9px")
			.style("font-family", "JetBrains Mono, monospace")
			.style("font-weight", "700")
			.style("fill", (d, i) => (i === safeWeek ? "#065f46" : "#374151"));

		// Interactive behaviors
		bars
			.on("mouseover", function (_event, _d) {
				d3.select(this).attr("opacity", 1.0).attr("fill", "#059669");
			})
			.on("mouseout", function (_event, d) {
				const idx = spendHistory.indexOf(d);
				d3.select(this)
					.attr("fill", idx === safeWeek ? "#10b981" : "#111827")
					.attr("opacity", idx === safeWeek ? 1.0 : 0.6);
			})
			.on("click", (_event, d) => {
				const idx = spendHistory.indexOf(d);
				setSelectedWeek(idx);
			});
	}, [safeWeek, spendHistory, hasSpendData]);

	return (
		<AppShell activeTab="profile">
			<section className="mb-6" id="profile_header">
				<div>
					<span className="text-[10px] font-black tracking-widest text-emerald-deep uppercase bg-emerald-deep/5 px-2.5 py-1 rounded">
						PRESET DESKS
					</span>
					<h2
						className="font-display font-black text-2xl text-emerald-strong mt-1.5"
						id="profile_headline"
					>
						Profile & Settings
					</h2>
					<p className="text-xs text-muted-grey">
						Manage your registered phone numbers, pinned buildings, and meal
						health metrics.
					</p>
				</div>
			</section>

			{msg && (
				<div
					className={`mb-6 p-4 rounded-2xl text-xs font-semibold flex items-start gap-2 animate-fade-in ${
						msg.type === "success"
							? "bg-emerald-deep/6 border border-emerald-deep/12 text-emerald-strong"
							: "bg-red-50 border border-red-200 text-danger"
					}`}
				>
					{msg.type === "success" ? (
						<Check className="w-4 h-4 shrink-0" />
					) : (
						<ShieldAlert className="w-5 h-5 shrink-0" />
					)}
					<span>{msg.txt}</span>
				</div>
			)}

			{/* Campus Healthy Nutritional Habits & Spending Analytics Card */}
			<GlassPanel className="p-6 mb-6">
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<Activity className="w-5 h-5 text-emerald-deep" />
						<h3 className="font-display font-bold text-sm text-emerald-strong">
							Nutritional Habits & Spending tracker
						</h3>
					</div>
					<span className="text-[9px] font-bold text-emerald-deep bg-emerald-deep/5 px-2 py-0.5 rounded uppercase">
						Interactive D3 Engine
					</span>
				</div>
				<p className="text-xs text-muted-grey mb-4 font-normal">
					{hasSpendData
						? "Click any weekly bar on the chart below to inspect category details, check your dietary health rating, and unlock nutrient insights!"
						: "Your weekly spending and nutrition insights appear here once you start ordering."}
				</p>

				{hasSpendData ? (
					<>
						{/* D3 Canvas container */}
						<div className="bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100 flex items-center justify-center mb-5">
							<div className="w-full max-w-sm md:max-w-md">
								<svg ref={svgRef} className="w-full h-auto" />
							</div>
						</div>

						{/* Dynamic Detail Insights box */}
						<div className="bg-white p-4.5 rounded-2xl border border-emerald-deep/10 shadow-xs relative overflow-hidden transition-all duration-300">
							<div className="absolute right-0 top-0 translate-x-3 -translate-y-3 w-16 h-16 bg-emerald-deep/5 rounded-full blur-xs pointer-events-none" />

							<div className="flex flex-wrap items-center justify-between gap-2.5 pb-3.5 border-b border-light-grey/15">
								<div>
									<span className="text-[9px] font-mono font-black text-muted-grey uppercase">
										Selected Period
									</span>
									<h4 className="font-display font-black text-xs text-ink-deep mt-0.5">
										{spendHistory[safeWeek].weekLabel} (Spending Period)
									</h4>
								</div>

								<div className="flex gap-4">
									<div>
										<span className="text-[9px] font-mono font-black text-muted-grey uppercase block">
											Top Category
										</span>
										<span className="text-xs font-bold text-emerald-strong">
											{spendHistory[safeWeek].mostOrderedCategory}
										</span>
									</div>
									<div className="text-right">
										<span className="text-[9px] font-mono font-black text-muted-grey uppercase block">
											Dietary Health Ratio
										</span>
										<span className="text-xs font-black text-emerald-deep flex items-center gap-0.5 justify-end">
											<Heart className="w-3.5 h-3.5 fill-current text-rose-500 shrink-0" />
											<span>{spendHistory[safeWeek].healthyIndex}%</span>
										</span>
									</div>
								</div>
							</div>

							<div className="mt-3 text-xs leading-relaxed text-[#2D3331]">
								<div className="flex gap-2 items-start">
									<Award className="w-4 h-4 text-emerald-deep shrink-0 mt-0.5" />
									<div>
										<p className="font-semibold text-[11px] text-ink-deep leading-tight">
											Campus Nutrition Advisor Insight:
										</p>
										<p className="text-muted-grey text-[11px] mt-1">
											{spendHistory[safeWeek].tip}
										</p>
									</div>
								</div>
							</div>
						</div>
					</>
				) : (
					<div className="bg-neutral-50/50 p-8 rounded-2xl border border-neutral-100 text-center">
						<Activity className="w-9 h-9 text-neutral-300 stroke-[1.2] mx-auto mb-2" />
						<p className="text-xs text-muted-grey">
							No spending yet. Place your first order to start building your
							weekly nutrition &amp; spending insights.
						</p>
					</div>
				)}
			</GlassPanel>

			{/* Wallet quick-access (v2) */}
			<GlassPanel className="p-0 mb-6 animate-fade-in overflow-hidden">
				<button
					onClick={() => navigateTo('/wallet')}
					className="w-full flex items-center gap-3 p-5 text-left cursor-pointer hover:bg-emerald-deep/[0.03] transition-colors"
					id="profile_wallet_link"
				>
					<div className="w-10 h-10 rounded-xl bg-emerald-deep/10 text-emerald-deep flex items-center justify-center shrink-0">
						<CreditCard className="w-5 h-5" />
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="font-display font-bold text-sm text-emerald-strong">My Wallet</h3>
						<p className="text-[11px] text-muted-grey">Balance, top up by transfer, and pay for orders instantly.</p>
					</div>
					<span className="text-muted-grey text-lg" aria-hidden>›</span>
				</button>
			</GlassPanel>

			{/* Dynamic Order History List */}
			<GlassPanel
				className="p-6 mb-6 animate-fade-in"
				id="profile_order_history_block"
			>
				<div className="flex items-center justify-between mb-4 pb-2 border-b border-[#10231C]/6">
					<div className="flex items-center gap-2">
						<History className="w-5 h-5 text-emerald-deep" />
						<h3 className="font-display font-bold text-sm text-emerald-strong">
							Your Campus Order History
						</h3>
					</div>
					<span className="text-[10px] font-bold text-muted-grey uppercase">
						Past Purchases
					</span>
				</div>

				{orders.length === 0 ? (
					<div className="text-center py-8">
						<History className="w-10 h-10 text-neutral-300 stroke-[1.2] mx-auto mb-2" />
						<p className="text-xs text-muted-grey">
							You don't have any past orders yet. Make a purchase to build your
							history!
						</p>
					</div>
				) : (
					<div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
						{[...orders]
							.sort(
								(a, b) =>
									new Date(b.createdAt).getTime() -
									new Date(a.createdAt).getTime(),
							)
							.map((order) => {
								const vendor = VENDORS.find((v) => v.id === order.vendorId);
								const isCompleted = ["DELIVERED", "CONFIRMED"].includes(
									order.status,
								);
								const isCancelled = ["CANCELLED", "REFUNDED"].includes(
									order.status,
								);

								const itemsSummary = order.items
									.map((it) => `${it.quantity}x ${it.name}`)
									.join(", ");

								return (
									<div
										key={order.id}
										className="p-4 rounded-2xl border border-[#10231C]/6 bg-white hover:border-[#10231C]/15 transition duration-200"
										id={`order_history_card_${order.id}`}
									>
										<div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
											<div>
												<span className="text-[10px] font-mono font-bold text-muted-grey">
													Order {order.orderNumber}
												</span>
												<h4 className="font-display font-extrabold text-xs text-ink-deep mt-0.5">
													{vendor?.name || "Vendor"}
												</h4>
											</div>

											<div className="flex items-center gap-2">
												<span
													className={`text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md ${
														isCompleted
															? "bg-emerald-deep/10 text-emerald-strong"
															: isCancelled
																? "bg-red-50 text-danger border border-red-100"
																: "bg-mango-warm/15 text-emerald-strong font-black animate-pulse"
													}`}
												>
													{order.status.replace(/_/g, " ")}
												</span>
											</div>
										</div>

										<div className="text-[11px] text-muted-grey line-clamp-1 mb-3.5">
											<strong>Items:</strong> {itemsSummary}
										</div>

										<div className="flex items-center justify-between pt-2.5 border-t border-neutral-50">
											<div className="flex flex-col">
												<span className="text-[9px] font-mono text-muted-grey">
													Total Cost
												</span>
												<Currency
													kobo={order.totalKobo}
													className="text-xs font-black text-ink-deep"
												/>
											</div>

											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => navigateTo(`/orders/${order.id}`)}
													className="px-3 py-1.5 border border-emerald-deep/12 hover:border-emerald-deep/30 bg-neutral-50/50 hover:bg-neutral-50/100 rounded-xl text-[10px] font-bold text-[#47544F] cursor-pointer transition"
													id={`history_track_${order.id}`}
												>
													Details
												</button>
												<button
													type="button"
													onClick={() => reorderOrder(order.id)}
													className="px-3 py-1.5 bg-emerald-deep hover:bg-emerald-strong text-white rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.01] active:scale-95 transition"
													id={`history_reorder_${order.id}`}
												>
													<RotateCcw className="w-3 h-3" />
													<span>One-Click Reorder</span>
												</button>
											</div>
										</div>
									</div>
								);
							})}
					</div>
				)}
			</GlassPanel>

			{/* Invite Friends & Referrals */}
			<GlassPanel className="p-6 mb-6" id="profile_referral_block">
				<div className="flex items-center justify-between mb-4 pb-2 border-b border-[#10231C]/6">
					<div className="flex items-center gap-2">
						<Gift className="w-5 h-5 text-emerald-deep" />
						<h3 className="font-display font-bold text-sm text-emerald-strong">
							Invite Friends
						</h3>
					</div>
					<span className="text-[10px] font-bold text-emerald-deep bg-emerald-deep/5 px-2 py-0.5 rounded uppercase">
						{referral ? `${referral.referredCount} joined` : 'Referrals'}
					</span>
				</div>

				<p className="text-xs text-muted-grey mb-4 leading-relaxed">
					Share your code with friends. They add it while setting up their account, and you get credited when they join Meal Direct.
				</p>

				{referral ? (
					<>
						{/* Referral code + copy */}
						<div className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-emerald-deep/12 bg-emerald-deep/[0.04] mb-3">
							<div className="min-w-0">
								<span className="text-[9px] font-mono font-black text-muted-grey uppercase block mb-1">
									Your referral code
								</span>
								<span className="font-mono font-black text-lg text-emerald-strong tracking-[0.25em] uppercase truncate block">
									{referral.code}
								</span>
							</div>
							<button
								type="button"
								onClick={() => handleCopy(referral.code, 'code')}
								className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-deep hover:bg-emerald-strong text-white text-[10px] font-bold transition cursor-pointer active:scale-95"
								id="profile_referral_copy_code"
							>
								{copied === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
								<span>{copied === 'code' ? 'Copied' : 'Copy'}</span>
							</button>
						</div>

						{/* Share link + actions */}
						<div className="flex items-center gap-2">
							<div className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-neutral-100 bg-neutral-50/60">
								<span className="text-[11px] text-muted-grey font-mono truncate block">
									{referralLink}
								</span>
							</div>
							<button
								type="button"
								onClick={() => handleCopy(referralLink, 'link')}
								className="shrink-0 p-2.5 rounded-xl border border-emerald-deep/12 bg-white hover:bg-emerald-deep/5 text-emerald-strong transition cursor-pointer active:scale-95"
								title="Copy invite link"
								id="profile_referral_copy_link"
							>
								{copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
							</button>
							<button
								type="button"
								onClick={handleShare}
								className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-mango-warm/15 hover:bg-mango-warm/25 text-emerald-strong text-[10px] font-bold transition cursor-pointer active:scale-95"
								id="profile_referral_share"
							>
								<Share2 className="w-3.5 h-3.5" />
								<span>Share</span>
							</button>
						</div>
					</>
				) : referralStatus === 'loading' ? (
					<div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-grey">
						<Gift className="w-4 h-4 text-neutral-300" />
						<span>Loading your referral code…</span>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center gap-3 py-6 text-xs text-muted-grey">
						<div className="flex items-center gap-2">
							<Gift className="w-4 h-4 text-neutral-300" />
							<span>Couldn't load your referral code.</span>
						</div>
						<button
							type="button"
							onClick={loadReferral}
							className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-deep hover:bg-emerald-strong text-white text-[10px] font-bold transition cursor-pointer active:scale-95"
							id="profile_referral_retry"
						>
							<RotateCcw className="w-3.5 h-3.5" />
							<span>Retry</span>
						</button>
					</div>
				)}
			</GlassPanel>

			<form onSubmit={handleSaveProfile} className="space-y-6">
				{/* Contact details */}
				<GlassPanel className="p-6">
					<h3 className="font-display font-bold text-sm text-emerald-strong mb-4 flex items-center gap-1.5">
						<User className="w-4.5 h-4.5 text-emerald-deep" />
						Basic Contact profile
					</h3>

					<div className="flex items-center gap-4 mb-6">
						<div className="w-16 h-16 rounded-full bg-emerald-deep/10 flex items-center justify-center text-emerald-deep font-bold text-xl uppercase shadow-sm border border-emerald-deep/20 overflow-hidden">
							{user?.avatarUrl ? (
								<img
									src={user.avatarUrl}
									alt={user.fullName ? `${user.fullName} avatar` : "Profile avatar"}
									className="w-full h-full object-cover"
								/>
							) : (
								user?.fullName?.charAt(0) || "G"
							)}
						</div>
						<div className="min-w-0 flex-1">
							<p className="text-xs font-bold text-emerald-strong">
								Profile Picture
							</p>
							<p className="text-[10px] text-muted-grey mt-0.5">
								JPEG, PNG, or WebP. Max 2 MB.
							</p>
						</div>
						<input
							ref={avatarInputRef}
							type="file"
							accept="image/jpeg,image/png,image/webp"
							onChange={handleAvatarFileChange}
							className="hidden"
							id="profile_avatar_input"
						/>
						<button
							type="button"
							onClick={() => avatarInputRef.current?.click()}
							disabled={isAvatarUploading}
							className="px-3.5 py-2.5 rounded-xl bg-emerald-deep hover:bg-emerald-strong text-white text-[10px] font-bold transition cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center gap-1.5 shrink-0"
							id="profile_avatar_upload_btn"
							aria-label="Upload profile avatar"
						>
							<Camera className="w-3.5 h-3.5" />
							<span>{isAvatarUploading ? "Uploading..." : "Upload"}</span>
						</button>
					</div>

					<div className="space-y-4">
						<div>
							<label htmlFor="profile_name_input" className="text-[9px] font-bold text-muted-grey block mb-1.5 uppercase">
								Full Student Name
							</label>
							<input
								type="text"
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
								className="w-full px-4 py-3 bg-white border border-emerald-deep/15 rounded-xl text-xs focus:ring-2 focus:ring-emerald-deep focus:outline-none font-semibold"
								required
								id="profile_name_input"
							/>
						</div>

						<div>
							<label htmlFor="profile_email_input" className="text-[9px] font-bold text-muted-grey block mb-1.5 uppercase">
								Email Address
							</label>
							<input
								type="email"
								value={user?.email || ""}
									placeholder="you@example.com"
								disabled
								className="w-full px-4 py-3 bg-neutral-50/50 border border-emerald-deep/15 rounded-xl text-xs font-semibold text-muted-grey cursor-not-allowed"
								id="profile_email_input"
							/>
						</div>

						<div>
							<label htmlFor="profile_phone_input" className="text-[9px] font-bold text-muted-grey block mb-1.5 uppercase">
								Emergency Contact Mobile ({selectedCountry.name})
							</label>
							<div className="flex gap-2.5">
								<div className="w-1/3 shrink-0 relative">
									<select
										value={selectedCountry.code}
										onChange={(e) => {
											const found = COUNTRIES.find(
												(c) => c.code === e.target.value,
											);
											if (found) {
												setSelectedCountry(found);
												setLocalPhone("");
											}
										}}
										className="w-full px-3 py-3 bg-neutral-50/50 hover:bg-neutral-50 border border-emerald-deep/15 rounded-xl font-bold text-xs focus:ring-2 focus:ring-emerald-deep focus:outline-none appearance-none cursor-pointer h-full text-ink-deep"
										id="profile_country_select"
									>
										{COUNTRIES.map((c) => (
											<option key={c.code} value={c.code}>
												{c.flag} {c.dialCode}
											</option>
										))}
									</select>
									<div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-grey text-[9px]">
										▼
									</div>
								</div>

								<div className="flex-1 relative">
									<div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
										<Phone className="w-4 h-4 text-emerald-deep/60" />
									</div>
									<input
										type="tel"
										placeholder={
											selectedCountry.code === "OTHER"
												? "+234 803 123 4567"
												: selectedCountry.placeholder
										}
										value={localPhone}
										onChange={(e) => {
											// Normalize and strip non-digit characters unless it's OTHER (which needs '+' for dialcode)
											const allowedChars =
												selectedCountry.code === "OTHER" ? /[^\d+]/g : /\D/g;
											setLocalPhone(e.target.value.replace(allowedChars, ""));
										}}
										className="w-full pl-10 pr-4 py-3 bg-white border border-emerald-deep/15 rounded-xl text-xs focus:ring-2 focus:ring-emerald-deep focus:outline-none font-bold font-mono text-ink-deep"
										required
										id="profile_phone_input"
									/>
								</div>
							</div>
							<span className="text-[9px] text-muted-grey mt-2 block font-medium">
								Example format: {selectedCountry.example}
							</span>
						</div>
					</div>
				</GlassPanel>

				{/* Pinned shortcuts overview panel */}
				{savedLocationIds.length > 0 && (
					<GlassPanel className="p-6">
						<h3 className="font-display font-bold text-sm text-emerald-strong mb-3 flex items-center gap-1.5">
							<Bookmark className="w-4.5 h-4.5 text-[#F3B33D] fill-current" />
							Your Pinned Delivery Shortcuts ({savedLocationIds.length})
						</h3>
						<p className="text-xs text-muted-grey mb-3.5 leading-relaxed">
							These campus locations are actively bookmarked as checkout
							shortcut cards. Tap any shortcut card below to instantly configure
							it as your your default delivery location.
						</p>
						<div className="flex flex-wrap gap-2">
							{savedLocationIds.map((locId) => {
								const loc = PRESET_LOCATIONS.find((l) => l.id === locId);
								if (!loc) return null;
								const isDefault = selectedLocation === locId;
								return (
									<div
										key={locId}
										role="button"
										tabIndex={0}
										onClick={() => setSelectedLocation(locId)}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												setSelectedLocation(locId);
											}
										}}
										className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition flex items-center justify-between gap-3 ${
											isDefault
												? "bg-emerald-deep/6 border-emerald-deep text-emerald-strong font-bold"
												: "bg-white border-neutral-100 hover:border-emerald-deep/20 text-[#374151]"
										}`}
									>
										<div className="flex items-center gap-1.5 min-w-0">
											<MapPin className="w-3.5 h-3.5 text-emerald-deep shrink-0" />
											<span className="truncate">{loc.name}</span>
										</div>
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												toggleSaveLocation(locId);
											}}
											className="text-[#F3B33D] hover:text-red-500 transition cursor-pointer shrink-0"
											title="Unpin location"
										>
											★
										</button>
									</div>
								);
							})}
						</div>
					</GlassPanel>
				)}

				{/* Dispatch terminal desks preset */}
				<GlassPanel className="p-6">
					<h3 className="font-display font-bold text-sm text-emerald-strong mb-4 flex items-center gap-1.5">
						<MapPin className="w-4.5 h-4.5 text-emerald-deep" />
						Default delivery location
					</h3>

					<p className="text-xs text-muted-grey mb-4 leading-relaxed">
						Choose where your orders are delivered by default. Use the star to
						pin locations as quick shortcuts at checkout.
					</p>

					<div className="mb-6">
						<label htmlFor="profile_campus_select" className="text-[9px] font-bold text-muted-grey block mb-1.5 uppercase">
							Active Campus Node
						</label>
						<select
							id="profile_campus_select"
							value={selectedCampus}
							onChange={(e) => {
								setSelectedCampus(e.target.value);
								setSelectedLocation("");
							}}
							className="w-full px-4 py-3 bg-white border border-emerald-deep/15 rounded-xl font-medium text-xs focus:ring-2 focus:ring-emerald-deep cursor-pointer focus:outline-none font-semibold"
						>
							{CAMPUSES.map((c) => (
								<option key={c.id} value={c.id}>
									{c.name}
								</option>
							))}
						</select>
					</div>

					<div className="space-y-6">
						{filteredLocs.length === 0 ? (
							<p className="text-xs text-muted-grey italic py-4 text-center">
								No delivery locations available for this campus yet. Please check
								back shortly.
							</p>
						) : (
							zoneGroups.map((group, zi) => (
								<div key={group.zoneName}>
									<span
										className={`text-[9px] font-black tracking-wider px-2 py-0.5 rounded uppercase ${
											zi % 2 === 0
												? "text-emerald-strong bg-emerald-deep/5"
												: "text-mango-warm bg-mango-warm/5"
										}`}
									>
										{group.zoneName}
									</span>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
										{[...group.hostels, ...group.depts].map((loc) => {
											const isPinned = savedLocationIds.includes(loc.id);
											return (
												<div
													key={loc.id}
													className={`flex items-center justify-between p-2.5 rounded-xl border transition text-xs ${
														selectedLocation === loc.id
															? "border-emerald-deep bg-emerald-deep/6"
															: "border-neutral-100 hover:border-emerald-deep/20 hover:bg-neutral-50/50"
													}`}
												>
													<button
														type="button"
														onClick={() => setSelectedLocation(loc.id)}
														className="flex-1 flex items-center gap-2 truncate text-left cursor-pointer font-bold text-emerald-strong"
													>
														{loc.type === "Hostel" ? (
															<Home className="w-4 h-4 text-emerald-deep/80 shrink-0" />
														) : (
															<Library className="w-4 h-4 text-emerald-deep/80 shrink-0" />
														)}
														<span className="truncate">{loc.name}</span>
													</button>

													<div className="flex items-center gap-1 px-1 shrink-0">
														{selectedLocation === loc.id && (
															<Check className="w-3.5 h-3.5 text-emerald-deep" />
														)}
														<button
															type="button"
															onClick={() => toggleSaveLocation(loc.id)}
															className={`p-1.5 rounded-lg transition active:scale-90 cursor-pointer ${
																isPinned
																	? "text-amber-500"
																	: "text-neutral-300 hover:text-neutral-500"
															}`}
															title={
																isPinned
																	? "Unpin building"
																	: "Pin building for quick shortcuts"
															}
														>
															<Bookmark
																className={`w-3.5 h-3.5 ${isPinned ? "fill-current" : ""}`}
															/>
														</button>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							))
						)}
					</div>
				</GlassPanel>

				<button
					type="submit"
					disabled={isSaving}
					className="w-full px-8 py-4 bg-emerald-deep hover:bg-emerald-strong text-white font-bold text-xs rounded-2xl shadow-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
					id="profile_save_btn"
				>
					<span>
						{isSaving ? "Saving…" : "Save changes"}
					</span>
				</button>
			</form>

			{/* Legal & Security */}
			<GlassPanel className="p-6 mt-6">
				<h3 className="font-display font-bold text-sm text-emerald-strong mb-4 flex items-center gap-1.5">
					<Shield className="w-4.5 h-4.5 text-emerald-deep" />
					Legal & Security
				</h3>

				<div className="space-y-2">
					<button
						type="button"
						onClick={() => setLegalModal(LEGAL_CONTENT.terms)}
						className="w-full flex items-center justify-between p-3.5 bg-white border border-emerald-deep/10 rounded-xl hover:bg-emerald-deep/5 transition cursor-pointer active:scale-95"
					>
						<div className="flex items-center gap-2.5">
							<FileText className="w-4 h-4 text-muted-grey" />
							<span className="text-xs font-bold text-emerald-strong">
								Terms of Service
							</span>
						</div>
						<span className="text-muted-grey text-xs">→</span>
					</button>

					<button
						type="button"
						onClick={() => setLegalModal(LEGAL_CONTENT.privacy)}
						className="w-full flex items-center justify-between p-3.5 bg-white border border-emerald-deep/10 rounded-xl hover:bg-emerald-deep/5 transition cursor-pointer active:scale-95"
					>
						<div className="flex items-center gap-2.5">
							<ShieldAlert className="w-4 h-4 text-muted-grey" />
							<span className="text-xs font-bold text-emerald-strong">
								Privacy Policy
							</span>
						</div>
						<span className="text-muted-grey text-xs">→</span>
					</button>

					<button
						type="button"
						onClick={() => setLegalModal(LEGAL_CONTENT.security)}
						className="w-full flex items-center justify-between p-3.5 bg-white border border-emerald-deep/10 rounded-xl hover:bg-emerald-deep/5 transition cursor-pointer active:scale-95"
					>
						<div className="flex items-center gap-2.5">
							<Lock className="w-4 h-4 text-muted-grey" />
							<span className="text-xs font-bold text-emerald-strong">
								Data Protection & Security
							</span>
						</div>
						<span className="text-muted-grey text-xs">→</span>
					</button>

					<button
						type="button"
						onClick={() => setLegalModal(LEGAL_CONTENT.community)}
						className="w-full flex items-center justify-between p-3.5 bg-white border border-emerald-deep/10 rounded-xl hover:bg-emerald-deep/5 transition cursor-pointer active:scale-95"
					>
						<div className="flex items-center gap-2.5">
							<Users className="w-4 h-4 text-muted-grey" />
							<span className="text-xs font-bold text-emerald-strong">
								Community Guidelines
							</span>
						</div>
						<span className="text-muted-grey text-xs">→</span>
					</button>

					<div className="flex items-start gap-2.5 p-3.5 mt-1 bg-emerald-deep/5 border border-emerald-deep/10 rounded-xl">
						<ShieldCheck className="w-4 h-4 text-emerald-deep shrink-0 mt-0.5" />
						<p className="text-[10px] text-muted-grey leading-relaxed">
							Your payments and personal data are encrypted in transit and
							secured on our servers. We never share your details with third
							parties without consent.
						</p>
					</div>

					<button
						type="button"
						onClick={() => setShowDeleteModal(true)}
						className="w-full flex items-center justify-between p-3.5 mt-4 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition cursor-pointer active:scale-95 group"
					>
						<div className="flex items-center gap-2.5">
							<Trash2 className="w-4 h-4 text-red-500 group-hover:text-red-600" />
							<span className="text-xs font-bold text-red-600">
								Delete Account & Data
							</span>
						</div>
					</button>
				</div>
			</GlassPanel>

			{/* Push Notifications */}
			<GlassPanel className="p-6 mt-6">
				<div className="flex items-center justify-between gap-4">
					<div>
						<h3 className="font-display font-bold text-sm text-emerald-strong">Push Notifications</h3>
						<p className="text-[11px] text-muted-grey mt-1 leading-relaxed max-w-sm">
							Get instant browser alerts when your order status changes, instead of waiting for the app to refresh.
						</p>
						{!pushConfigured && (
							<p className="text-[10px] text-warning mt-1.5 font-semibold">
								Push notifications aren’t configured for this build (missing VAPID key). Status updates still arrive via auto-refresh.
							</p>
						)}
						{pushConfigured && pushState === 'unavailable' && (
							<p className="text-[10px] text-warning mt-1.5 font-semibold">
								Push unavailable (permission denied or not configured). Status updates still arrive via auto-refresh.
							</p>
						)}
					</div>
					<div className="flex gap-2 shrink-0">
						<button
							onClick={handleEnablePush}
							disabled={!pushConfigured || pushState === 'loading' || pushState === 'enabled'}
							className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
								pushState === 'enabled'
									? 'bg-emerald-deep/10 text-emerald-strong cursor-default'
									: 'bg-emerald-deep hover:bg-emerald-strong text-white disabled:opacity-50'
							}`}
							id="enable_push_btn"
						>
							{pushState === 'enabled' ? 'Enabled' : pushState === 'loading' ? 'Working…' : 'Enable'}
						</button>
						{pushState === 'enabled' && (
							<button
								onClick={handleDisablePush}
								className="px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer bg-neutral-100 hover:bg-neutral-200 text-emerald-strong"
								id="disable_push_btn"
							>
								Disable
							</button>
						)}
					</div>
				</div>
			</GlassPanel>

			<div className="h-10" />

			{/* Legal & Security text modal */}
			{legalModal && (
				<dialog open className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent backdrop:bg-black/85 backdrop:backdrop-blur-xs m-auto outline-none w-full h-full animate-fade-in">
					<div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-neutral-200 shadow-2xl flex flex-col gap-5 relative max-h-[85vh]">
						<h3 className="font-display font-black text-xl text-emerald-strong">{legalModal.title}</h3>
						<p className="text-xs text-muted-grey leading-relaxed overflow-y-auto pr-1">
							{legalModal.body}
						</p>
						<button
							onClick={() => setLegalModal(null)}
							className="w-full py-3.5 bg-emerald-deep hover:bg-emerald-strong text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm"
						>
							Close
						</button>
					</div>
				</dialog>
			)}

			{/* Delete Account Modal */}
			{showDeleteModal && (
				<dialog open className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent backdrop:bg-black/85 backdrop:backdrop-blur-xs m-auto outline-none w-full h-full animate-fade-in">
					<div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full border border-neutral-200 shadow-2xl flex flex-col gap-6 relative shadow-red-500/5">
						<h3 className="font-display font-black text-xl text-red-600 text-center">Delete Account?</h3>
						<p className="text-xs text-muted-grey text-center leading-relaxed">
							This action is permanent. All your order history, pinned delivery locations, and rewards will be permanently deleted from our servers.
						</p>
						<div className="flex flex-col gap-3">
							<button
								onClick={() => {
									setShowDeleteModal(false);
									signOut();
									navigateTo('/');
								}}
								className="w-full py-3.5 bg-danger hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm"
							>
								Yes, Delete Everything
							</button>
							<button
								onClick={() => setShowDeleteModal(false)}
								className="w-full py-3.5 bg-neutral-100 hover:bg-neutral-200 text-emerald-strong font-bold text-xs rounded-xl transition cursor-pointer"
							>
								No, Keep My Account
							</button>
						</div>
					</div>
				</dialog>
			)}
		</AppShell>
	);
};
