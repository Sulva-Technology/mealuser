/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimatePresence, motion } from "motion/react";
import React from "react";
import { AuthView } from "./components/AuthView";
import { CartView } from "./components/CartView";
import { CheckoutView } from "./components/CheckoutView";
import { HomeView } from "./components/HomeView";
import { NotificationsView } from "./components/NotificationsView";
import { OfflineView } from "./components/OfflineView";
import { OnboardingView } from "./components/OnboardingView";
import { OrderDetailView } from "./components/OrderDetailView";
import { OrdersView } from "./components/OrdersView";
import { PaymentStatusView } from "./components/PaymentStatusView";
import { ProfileView } from "./components/ProfileView";
import { VendorDetailView } from "./components/VendorDetailView";
import { VendorsView } from "./components/VendorsView";
import { MealDirectProvider, useMealDirect } from "./store";

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
				{renderRoute()}
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
