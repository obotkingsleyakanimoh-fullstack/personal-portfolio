import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { SiteLayout } from './components/SiteLayout';
import {
  AboutPage, AdminPage, ChatPage, CheckoutPage, ContentCheckoutPage, ContactPage, DashboardPage, GalleryPage,
  HomePage, LegalPage, LoginPage, MembershipPage, VideosPage, AccountPage, PaymentsPage, PurchasesPage,
} from './pages/Pages';

const rootRoute = createRootRoute({ component: SiteLayout });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/about', component: AboutPage });
const galleryRoute = createRoute({ getParentRoute: () => rootRoute, path: '/gallery', component: GalleryPage });
const videosRoute = createRoute({ getParentRoute: () => rootRoute, path: '/videos', component: VideosPage });
const membershipRoute = createRoute({ getParentRoute: () => rootRoute, path: '/membership', component: MembershipPage });
const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/checkout/$planId', component: CheckoutPage });
const contentCheckoutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/content-checkout/$contentId', component: ContentCheckoutPage });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage });
const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/dashboard', component: DashboardPage });
const accountRoute = createRoute({ getParentRoute: () => rootRoute, path: '/account', component: AccountPage });
const paymentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/payments', component: PaymentsPage });
const purchasesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/purchases', component: PurchasesPage });
const chatRoute = createRoute({ getParentRoute: () => rootRoute, path: '/chat', component: ChatPage });
const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: AdminPage });
const contactRoute = createRoute({ getParentRoute: () => rootRoute, path: '/contact', component: ContactPage });
const privacyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/privacy', component: () => <LegalPage kind="privacy" /> });
const termsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/terms', component: () => <LegalPage kind="terms" /> });
const refundsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/refunds', component: () => <LegalPage kind="refunds" /> });
const cookiesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cookies', component: () => <LegalPage kind="cookies" /> });

const routeTree = rootRoute.addChildren([
  indexRoute, aboutRoute, galleryRoute, videosRoute, membershipRoute, checkoutRoute, contentCheckoutRoute,
  loginRoute, dashboardRoute, accountRoute, paymentsRoute, purchasesRoute, chatRoute, adminRoute, contactRoute, privacyRoute,
  termsRoute, refundsRoute, cookiesRoute,
]);
export const router = createRouter({ routeTree, defaultPreload: 'intent' });
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
