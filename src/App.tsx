/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimatePresence, motion } from "motion/react";
import React, { Suspense } from "react";
import { AuthView } from "./components/AuthView";
import { CheckoutView } from "./components/CheckoutView";
import { HomeView } from "./components/HomeView";
import { OrderDetailView } from "./components/OrderDetailView";
import { OrdersView } from "./components/OrdersView";
import { PaymentStatusView } from "./components/PaymentStatusView";
import { MealDirectProvider, useMealDirect } from "./store";

const CartView = React.lazy(() => import("./components/CartView").then(module => ({ default: module.CartView })));
const NotificationsView = React.lazy(() => import("./components/NotificationsView").then(module => ({ default: module.NotificationsView })));
const OfflineView = React.lazy(() => import("./components/OfflineView").then(module => ({ default: module.OfflineView })));
const OnboardingView = React.lazy(() => import("./components/OnboardingView").then(module => ({ default: module.OnboardingView })));
const ProfileView = React.lazy(() => import("./components/ProfileView").then(module => ({ default: module.ProfileView })));
const VendorDetailView = React.lazy(() => import("./components/VendorDetailView").then(module => ({ default: module.VendorDetailView })));
const VendorsView = React.lazy(() => import("./components/VendorsView").then(module => ({ default: module.VendorsView })));

const RouteFallback = () => (
	<div className="h-full w-full flex items-center justify-center p-8">
		<div className="w-8 h-8 border-2 border-emerald-deep/20 border-t-emerald-deep rounded-full animate-spin" />
	</div>
);

const RouteDispatcher: React.FC = () => {
	const { router, user } = useMealDirect();
	const { path, params } = router;

	const renderRoute = () => {
		// Auth check guard: redirect unauthenticated users to login
		if (!user) {
			return <AuthView />;
		}

		// Onboard check guard: redirect onboard pending students to onboarding
		if (user && !user.isOnboarded && path !== "/onboarding") {
			return <OnboardingView />;
		}

		// Hash SPA routing map
		switch (path) {
			case "/":
				return <HomeView />;
			case "/onboarding":
				return <OnboardingView />;
			case "/home":
				return <HomeView />;
			case "/vendors":
				return <VendorsView />;
			case "/cart":
				return <CartView />;
			case "/checkout":
				return <CheckoutView />;
			case "/orders":
				return <OrdersView />;
			case "/notifications":
				return <NotificationsView />;
			case "/profile":
				return <ProfileView />;
			case "/offline":
				return <OfflineView />;
			default:
				// Dynamic routing switches
				if (path.startsWith("/vendors/") && params.vendorId) {
					return <VendorDetailView vendorId={params.vendorId} />;
				}
				if (path.startsWith("/payment/status/") && params.orderId) {
					return <PaymentStatusView orderId={params.orderId} />;
				}
				if (path.startsWith("/orders/") && params.orderId) {
					return <OrderDetailView orderId={params.orderId} />;
				}

				// Fallback
				return <HomeView />;
		}
	};

	return (
		<AnimatePresence mode="wait">
			<motion.div
				key={path}
				initial={{ opacity: 0, y: 15 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -15 }}
				transition={{ duration: 0.2, ease: "easeOut" }}
				className="h-full w-full"
			>
				<Suspense fallback={<RouteFallback />}>
					{renderRoute()}
				</Suspense>
			</motion.div>
		</AnimatePresence>
	);
};

export default function App() {
	React.useEffect(() => {
		const handleTouch = (e: TouchEvent | MouseEvent) => {
			// Find closest button or elements representing interactive roles
			const target = e.target as HTMLElement;
			const button = target.closest('button, a, [role="button"]');
			if (button) {
				if (navigator.vibrate) {
					// Subtle tap haptic
					navigator.vibrate(10);
				}
			}
		};

		// Use touchstart to provide immediate haptic feedback before the click completes
		document.addEventListener("touchstart", handleTouch as EventListener, {
			passive: true,
		});

		return () => {
			document.removeEventListener("touchstart", handleTouch as EventListener);
		};
	}, []);

	return (
		<MealDirectProvider>
			<RouteDispatcher />
		</MealDirectProvider>
	);
}
