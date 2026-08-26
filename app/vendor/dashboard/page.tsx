"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FileUploadField from "@/components/forms/FileUploadField";
import {
  VENDOR_AGREEMENT_VERSION,
  hasAcceptedCurrentVendorAgreement,
} from "@/lib/legal-policy";
import { formatRupees } from "@/lib/pricing";
import { useCartStore } from "@/store/cart-store";

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  price: number;
  mrp?: number | null;
  vendorPrice?: number | null;
  discountPercent?: number | null;
  platformCommissionAmount?: number | null;
  packagingCharge?: number | null;
  vendorPayout?: number | null;
  inventory: number;
  images: string[];
  createdAt?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
  subcategory?: {
    id: string;
    name: string;
  } | null;
  variants?: Array<{
    id: string;
    sizeLabel?: string | null;
    numericSize?: string | null;
    color?: string | null;
    sku?: string | null;
    stockQuantity: number;
    status: string;
    price?: number | null;
    mrp?: number | null;
  }>;
};

type Category = {
  id: string;
  name: string;
};

type VendorOrderItem = {
  id: string;
  productId: string;
  variantId?: string | null;
  sizeLabel?: string | null;
  numericSize?: string | null;
  variantColor?: string | null;
  variantSku?: string | null;
  quantity: number;
  price: number;
  mrp?: number | null;
  vendorPrice?: number | null;
  platformCommissionAmount?: number | null;
  packagingCharge?: number | null;
  vendorPayout?: number | null;
  product?: {
    id: string;
    name: string;
    images?: string[] | null;
    sku?: string | null;
  } | null;
};

type VendorOrder = {
  id: string;
  totalAmount: number;
  status: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";
  paymentMethod: string;
  paymentId?: string | null;
  shippingName?: string | null;
  shippingPhone?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZipCode?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  statusNote?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  user?: {
    name: string;
    email: string;
  } | null;
  items: VendorOrderItem[];
  trust?: {
    verification?: {
      verificationId?: string;
      openBoxEligible?: boolean;
      verifiedDelivered?: boolean;
    } | null;
    dispatchImages?: Array<{
      id: string;
      imageType: string;
      url: string;
    }>;
    deliveryOtp?: {
      verified?: boolean;
    } | null;
  };
};

type VendorProfile = {
  id?: string;
  storeName: string;
  description?: string | null;
  logoUrl?: string | null;
  mobile?: string | null;
  businessCategory?: string | null;
  businessAddress?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  aadhaarNumber?: string | null;
  bankDetails?: string | null;
  upiId?: string | null;
  documentsKyc?: string | null;
  panCardUrl?: string | null;
  aadhaarUrl?: string | null;
  gstCertificateUrl?: string | null;
  bankProofUrl?: string | null;
  status?: "PENDING" | "APPROVED" | "REJECTED" | "INACTIVE";
  kycStatus?: "NOT_SUBMITTED" | "SUBMITTED" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  workingHours?: string | null;
  deliveryArea?: string | null;
  metadata?: Record<string, unknown> | null;
};

type VendorUser = {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
  vendorProfile?: VendorProfile | null;
};

type VendorNotification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

type DashboardSection =
  | "dashboard"
  | "profile"
  | "business"
  | "products"
  | "orders"
  | "inventory"
  | "customers"
  | "messages"
  | "payments"
  | "offers"
  | "reviews"
  | "reports"
  | "kyc"
  | "notifications"
  | "support"
  | "settings";

const courierCompanies = [
  "Delhivery",
  "Blue Dart",
  "DTDC",
  "Ekart Logistics",
  "Ecom Express",
  "XpressBees",
  "India Post",
  "Shadowfax",
  "Amazon Shipping",
  "Shiprocket",
  "DHL",
  "FedEx",
  "Aramex",
  "Porter",
  "Local Courier",
];

type ProfileForm = {
  name: string;
  storeName: string;
  description: string;
  logoUrl: string;
  mobile: string;
  businessCategory: string;
  businessAddress: string;
  gstNumber: string;
  panNumber: string;
  aadhaarNumber: string;
  bankDetails: string;
  upiId: string;
  documentsKyc: string;
  panCardUrl: string;
  aadhaarUrl: string;
  gstCertificateUrl: string;
  bankProofUrl: string;
  workingHours: string;
  deliveryArea: string;
};

const emptyProfileForm: ProfileForm = {
  name: "",
  storeName: "",
  description: "",
  logoUrl: "",
  mobile: "",
  businessCategory: "",
  businessAddress: "",
  gstNumber: "",
  panNumber: "",
  aadhaarNumber: "",
  bankDetails: "",
  upiId: "",
  documentsKyc: "",
  panCardUrl: "",
  aadhaarUrl: "",
  gstCertificateUrl: "",
  bankProofUrl: "",
  workingHours: "",
  deliveryArea: "",
};

const sidebarItems: Array<{ label: string; section: DashboardSection; href?: string }> = [
  { label: "Dashboard", section: "dashboard" },
  { label: "Orders", section: "orders" },
  { label: "My Store", section: "products" },
  { label: "Stock Management", section: "inventory", href: "/vendor/dashboard/inventory" },
  { label: "Warehouses", section: "inventory", href: "/vendor/dashboard/warehouses" },
  { label: "Customers", section: "customers" },
  { label: "Messages", section: "messages" },
  { label: "Payments & Wallet", section: "payments" },
  { label: "Offers / Coupons", section: "offers" },
  { label: "Reviews & Ratings", section: "reviews" },
  { label: "Reports / Analytics", section: "reports" },
  { label: "Profile Operations", section: "profile", href: "/vendor/dashboard/profile" },
  { label: "Business Profile", section: "business" },
  { label: "Documents / KYC", section: "kyc" },
  { label: "Support", section: "support" },
  { label: "Settings", section: "settings" },
];

const profileMenuItems: Array<{ label: string; section: DashboardSection }> = [
  { label: "My Profile", section: "profile" },
  { label: "Business Details", section: "business" },
  { label: "My Store", section: "products" },
  { label: "Orders", section: "orders" },
  { label: "Payments", section: "payments" },
  { label: "Reviews", section: "reviews" },
  { label: "Notifications", section: "notifications" },
  { label: "Settings", section: "settings" },
  { label: "Help & Support", section: "support" },
];

const sectionTitles: Record<DashboardSection, string> = {
  dashboard: "Dashboard",
  profile: "My Profile",
  business: "Business Details",
  products: "My Store",
  orders: "Orders",
  inventory: "Stock Management",
  customers: "Customers",
  messages: "Messages",
  payments: "Payments & Wallet",
  offers: "Offers / Coupons",
  reviews: "Reviews & Ratings",
  reports: "Reports / Analytics",
  kyc: "Documents / KYC",
  notifications: "Notifications",
  support: "Help & Support",
  settings: "Settings",
};

function formFromVendor(user: VendorUser | null): ProfileForm {
  const profile = user?.vendorProfile;

  return {
    name: user?.name || "",
    storeName: profile?.storeName || "",
    description: profile?.description || "",
    logoUrl: profile?.logoUrl || "",
    mobile: profile?.mobile || "",
    businessCategory: profile?.businessCategory || "",
    businessAddress: profile?.businessAddress || "",
    gstNumber: profile?.gstNumber || "",
    panNumber: profile?.panNumber || "",
    aadhaarNumber: profile?.aadhaarNumber || "",
    bankDetails: profile?.bankDetails || "",
    upiId: profile?.upiId || "",
    documentsKyc: profile?.documentsKyc || "",
    panCardUrl: profile?.panCardUrl || "",
    aadhaarUrl: profile?.aadhaarUrl || "",
    gstCertificateUrl: profile?.gstCertificateUrl || "",
    bankProofUrl: profile?.bankProofUrl || "",
    workingHours: profile?.workingHours || "",
    deliveryArea: profile?.deliveryArea || "",
  };
}

export default function VendorDashboardPage() {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clearCart);
  const [adminVendorId, setAdminVendorId] = useState<string | null>(null);
  const [activeSection, setActiveSection] =
    useState<DashboardSection>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendor, setVendor] = useState<VendorUser | null>(null);
  const [profileForm, setProfileForm] =
    useState<ProfileForm>(emptyProfileForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [carriers, setCarriers] = useState<Record<string, string>>({});
  const [dispatchProductImages, setDispatchProductImages] = useState<Record<string, string[]>>({});
  const [dispatchPackedImages, setDispatchPackedImages] = useState<Record<string, string[]>>({});
  const [shippingLabelImages, setShippingLabelImages] = useState<Record<string, string>>({});
  const [openBoxOrders, setOpenBoxOrders] = useState<Record<string, boolean>>({});
  const [deliveryOtps, setDeliveryOtps] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [adminPreview, setAdminPreview] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [acceptingAgreement, setAcceptingAgreement] = useState(false);
  const [showPendingProfileEditor, setShowPendingProfileEditor] =
    useState(false);

  useEffect(() => {
    setAdminVendorId(new URLSearchParams(window.location.search).get("adminVendorId") || "");
  }, []);

  useEffect(() => {
    if (adminVendorId === null) {
      return;
    }

    let isActive = true;

    async function loadDashboard() {
      if (adminVendorId) {
        const previewResponse = await fetch(
          `/api/admin/vendors/${adminVendorId}/dashboard`,
          { cache: "no-store" },
        );
        const previewData = await previewResponse.json();

        if (!isActive) {
          return;
        }

        if (!previewResponse.ok) {
          setMessage(previewData.error || "Could not load vendor dashboard preview.");
          setLoading(false);
          return;
        }

        setAdminPreview(true);
        setVendor(previewData.user);
        setProfileForm(formFromVendor(previewData.user));
        setProducts(previewData.products || []);
        setOrders(previewData.orders || []);
        setCategories(previewData.categories || []);
        setNotifications(previewData.notifications || []);
        setUnreadNotifications(Number(previewData.unreadCount || 0));
        setLoading(false);
        return;
      }

      const userResponse = await fetch("/api/auth/me", { cache: "no-store" });
      const userData = await userResponse.json();

      if (!isActive) {
        return;
      }

      if (!userData.user) {
        setMessage("Please login as a vendor to view your dashboard.");
        setLoading(false);
        return;
      }

      if (userData.user.role !== "VENDOR") {
        setMessage("Please register as a vendor before using this dashboard.");
        setLoading(false);
        return;
      }

      setVendor(userData.user);
      setProfileForm(formFromVendor(userData.user));

      if (userData.user.vendorProfile?.status !== "APPROVED") {
        const categoriesResponse = await fetch("/api/categories", {
          cache: "no-store",
        });

        if (categoriesResponse.ok && isActive) {
          const data = await categoriesResponse.json();
          setCategories(data.categories || []);
        }

        setLoading(false);
        return;
      }

      const [
        productsResponse,
        ordersResponse,
        categoriesResponse,
        notificationsResponse,
      ] = await Promise.all([
        fetch("/api/vendor/products", { cache: "no-store" }),
        fetch("/api/vendor/orders", { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
        fetch("/api/vendor/notifications", { cache: "no-store" }),
      ]);

      if (!isActive) {
        return;
      }

      if (productsResponse.ok) {
        const data = await productsResponse.json();
        setProducts(data.products || []);
      } else {
        const data = await productsResponse.json();
        setMessage(data.error || "Could not load vendor products.");
      }

      if (ordersResponse.ok) {
        const data = await ordersResponse.json();
        setOrders(data.orders || []);
      }

      if (categoriesResponse.ok) {
        const data = await categoriesResponse.json();
        setCategories(data.categories || []);
      }

      if (notificationsResponse.ok) {
        const data = await notificationsResponse.json();
        setNotifications(data.notifications || []);
        setUnreadNotifications(Number(data.unreadCount || 0));
      }

      setLoading(false);
    }

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, [adminVendorId]);

  const vendorName = vendor?.name || "Vendor";
  const businessName = vendor?.vendorProfile?.storeName || "Your Business";
  const agreementRequired = Boolean(
    vendor?.role === "VENDOR" &&
      vendor.vendorProfile &&
      !adminPreview &&
      !hasAcceptedCurrentVendorAgreement(vendor.vendorProfile.metadata)
  );
  const approvedProducts = products.length;
  const totalStock = products.reduce(
    (sum, product) => sum + Number(product.inventory || 0),
    0
  );
  const todayKey = new Date().toDateString();
  const todaysOrders = orders.filter(
    (order) => new Date(order.createdAt).toDateString() === todayKey
  ).length;
  const pendingOrders = orders.filter((order) =>
    ["PENDING", "PAID"].includes(order.status)
  ).length;
  const completedOrders = orders.filter(
    (order) => order.status === "DELIVERED"
  ).length;
  const totalSales = orders
    .filter((order) => !["CANCELLED", "RETURNED"].includes(order.status))
    .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const pendingPayments = orders
    .filter((order) => order.status === "PENDING")
    .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  const profileTasks = useMemo(
    () => [
      {
        label: "Name",
        done: Boolean(vendor?.name),
        section: "profile" as DashboardSection,
      },
      {
        label: "Mobile number",
        done: Boolean(vendor?.vendorProfile?.mobile),
        section: "profile" as DashboardSection,
      },
      {
        label: "Email",
        done: Boolean(vendor?.email),
        section: "profile" as DashboardSection,
      },
      {
        label: "Business name",
        done: Boolean(vendor?.vendorProfile?.storeName),
        section: "business" as DashboardSection,
      },
      {
        label: "Business description",
        done: Boolean(vendor?.vendorProfile?.description),
        section: "business" as DashboardSection,
      },
      {
        label: "Business category",
        done: Boolean(vendor?.vendorProfile?.businessCategory),
        section: "business" as DashboardSection,
      },
      {
        label: "Business address",
        done: Boolean(vendor?.vendorProfile?.businessAddress),
        section: "business" as DashboardSection,
      },
      {
        label: "GST number, if needed",
        done: Boolean(vendor?.vendorProfile?.gstNumber),
        section: "kyc" as DashboardSection,
      },
      {
        label: "PAN number",
        done: Boolean(vendor?.vendorProfile?.panNumber),
        section: "kyc" as DashboardSection,
      },
      {
        label: "Aadhaar number",
        done: Boolean(vendor?.vendorProfile?.aadhaarNumber),
        section: "kyc" as DashboardSection,
      },
      {
        label: "Bank details",
        done: Boolean(vendor?.vendorProfile?.bankDetails),
        section: "payments" as DashboardSection,
      },
      {
        label: "UPI ID",
        done: Boolean(vendor?.vendorProfile?.upiId),
        section: "payments" as DashboardSection,
      },
      {
        label: "Documents / KYC",
        done: Boolean(
          vendor?.vendorProfile?.documentsKyc ||
            vendor?.vendorProfile?.panCardUrl ||
            vendor?.vendorProfile?.aadhaarUrl ||
            vendor?.vendorProfile?.gstCertificateUrl ||
            vendor?.vendorProfile?.bankProofUrl
        ),
        section: "kyc" as DashboardSection,
      },
      {
        label: "Logo / shop image",
        done: Boolean(vendor?.vendorProfile?.logoUrl),
        section: "business" as DashboardSection,
      },
      {
        label: "Working hours",
        done: Boolean(vendor?.vendorProfile?.workingHours),
        section: "business" as DashboardSection,
      },
      {
        label: "Delivery/service area",
        done: Boolean(vendor?.vendorProfile?.deliveryArea),
        section: "business" as DashboardSection,
      },
    ],
    [vendor]
  );

  const pendingTasks = profileTasks.filter((task) => !task.done);

  const statCards = [
    { label: "Today's Orders", value: todaysOrders, tone: "text-blue-600" },
    { label: "Pending Orders", value: pendingOrders, tone: "text-yellow-600" },
    { label: "Completed Orders", value: completedOrders, tone: "text-green-600" },
    {
      label: "Total Sales",
      value: `Rs. ${totalSales.toFixed(2)}`,
      tone: "text-pink-600",
    },
    {
      label: "Pending Payments",
      value: `Rs. ${pendingPayments.toFixed(2)}`,
      tone: "text-red-600",
    },
    {
      label: "Product/Service Listings",
      value: products.length,
      tone: "text-purple-600",
    },
    { label: "Customer Messages", value: "0", tone: "text-indigo-600" },
    { label: "Ratings & Reviews", value: "0.0", tone: "text-amber-600" },
    {
      label: "Notifications",
      value: unreadNotifications,
      tone: "text-slate-700",
    },
    {
      label: "Approved Products",
      value: approvedProducts,
      tone: "text-green-600",
    },
  ];

  function getCategoryName(categoryId?: string | null) {
    return (
      categories.find((category) => category.id === categoryId)?.name ||
      "Category"
    );
  }

  function getStatusTone(status: VendorOrder["status"]) {
    const tones: Record<VendorOrder["status"], string> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      PAID: "bg-blue-100 text-blue-800",
      SHIPPED: "bg-purple-100 text-purple-800",
      DELIVERED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
      RETURNED: "bg-gray-200 text-gray-800",
    };
    return tones[status] || "bg-gray-100 text-gray-800";
  }

  async function updateOrderStatus(
    order: VendorOrder,
    status: VendorOrder["status"]
  ) {
    if (adminPreview) {
      setOrderMessage("Admin preview is read-only. Order updates are disabled here.");
      return;
    }

    const trackingNumber =
      status === "SHIPPED" ? trackingNumbers[order.id] || order.trackingNumber || "" : "";
    const carrier =
      status === "SHIPPED" ? carriers[order.id] || order.carrier || "" : "";

    if (status === "SHIPPED" && (!carrier.trim() || !trackingNumber.trim())) {
      setOrderMessage("Please enter courier company and tracking number before marking shipped.");
      return;
    }

    if (status === "SHIPPED" && (!order.carrier || !order.trackingNumber)) {
      setOrderMessage("First save courier details, then print/download label, upload proof images and mark shipped.");
      return;
    }

    const deliveryOtp = deliveryOtps[order.id]?.trim() || "";
    if (
      status === "DELIVERED" &&
      order.trust?.deliveryOtp &&
      !order.trust.deliveryOtp.verified &&
      !deliveryOtp
    ) {
      setOrderMessage("Please enter the customer delivery OTP before marking delivered.");
      return;
    }

    const productProofs = dispatchProductImages[order.id] || [];
    const packedProofs = dispatchPackedImages[order.id] || [];
    const shippingLabelImage = shippingLabelImages[order.id] || "";
    const hasExistingProof = Boolean(order.trust?.dispatchImages?.length);

    if (
      status === "SHIPPED" &&
      !hasExistingProof &&
      (productProofs.length === 0 || packedProofs.length === 0 || !shippingLabelImage)
    ) {
      setOrderMessage(
        "Upload product proof, packed product proof and shipping label before marking shipped."
      );
      return;
    }

    setUpdatingOrderId(order.id);
    setOrderMessage("");

    try {
      const response = await fetch(`/api/vendor/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          trackingNumber,
          carrier,
          dispatchProductImages: productProofs,
          dispatchPackedImages: packedProofs,
          shippingLabelImage,
          openBoxEligible: Boolean(openBoxOrders[order.id]),
          deliveryOtp,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setOrderMessage(data.error || "Order update failed.");
        return;
      }

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === order.id ? data.order : currentOrder
        )
      );
      setOrderMessage(`Order ${order.id.slice(-6)} updated to ${status}.`);
    } catch (error) {
      setOrderMessage(
        error instanceof Error ? error.message : "Order update failed."
      );
    } finally {
      setUpdatingOrderId("");
    }
  }

  async function saveCourierDetails(order: VendorOrder) {
    if (adminPreview) {
      setOrderMessage("Admin preview is read-only. Courier updates are disabled here.");
      return;
    }

    const trackingNumber = trackingNumbers[order.id] || order.trackingNumber || "";
    const carrier = carriers[order.id] || order.carrier || "";

    if (!carrier.trim() || !trackingNumber.trim()) {
      setOrderMessage("Please enter courier company and tracking/AWB number first.");
      return;
    }

    setUpdatingOrderId(order.id);
    setOrderMessage("");

    try {
      const response = await fetch(`/api/vendor/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SAVE_COURIER_DETAILS",
          trackingNumber,
          carrier,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setOrderMessage(data.error || "Courier details save failed.");
        return;
      }

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === order.id ? data.order : currentOrder
        )
      );
      setOrderMessage(data.message || "Courier details saved.");
    } catch (error) {
      setOrderMessage(
        error instanceof Error ? error.message : "Courier details save failed."
      );
    } finally {
      setUpdatingOrderId("");
    }
  }

  function openSection(section: DashboardSection) {
    setActiveSection(section);
    setProfileOpen(false);
    setSaveMessage("");
  }

  async function markNotificationsRead(notificationId = "") {
    if (adminPreview) {
      return;
    }

    const response = await fetch("/api/vendor/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setNotifications(data.notifications || []);
      setUnreadNotifications(Number(data.unreadCount || 0));
    }
  }

  function handleFormChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setProfileForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function setProfileField(name: keyof ProfileForm, value: string) {
    setProfileForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveMessage("");

    if (adminPreview) {
      setSaveMessage("Admin preview is read-only. Profile changes are disabled here.");
      return;
    }

    setSavingProfile(true);

    try {
      const response = await fetch("/api/vendor/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        setSaveMessage(data.error || "Could not save profile details.");
        return;
      }

      setVendor(data.user);
      setProfileForm(formFromVendor(data.user));
      setSaveMessage("Profile details saved. Pending task status updated.");
    } catch {
      setSaveMessage("Profile save service is not responding. Restart server and try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function acceptLatestAgreement() {
    setAcceptingAgreement(true);
    setSaveMessage("");

    try {
      const response = await fetch("/api/vendor/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      const data = await response.json();

      if (!response.ok) {
        setSaveMessage(data.error || "Could not accept vendor agreement.");
        return;
      }

      if (data.user) {
        setVendor(data.user);
        setProfileForm(formFromVendor(data.user));
      } else {
        const userResponse = await fetch("/api/auth/me", { cache: "no-store" });
        const userData = await userResponse.json();
        if (userData.user) {
          setVendor(userData.user);
          setProfileForm(formFromVendor(userData.user));
        }
      }

      setSaveMessage("Vendor agreement accepted. You can continue using your dashboard.");
    } catch {
      setSaveMessage("Agreement service is not responding. Try again in a moment.");
    } finally {
      setAcceptingAgreement(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearCart();
    router.push("/login");
    router.refresh();
  }

  function renderProfileForm() {
    return (
      <section className="rounded-2xl bg-white p-5 shadow">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">
              Complete Vendor Profile
            </h2>
            <p className="text-sm text-gray-500">
              Fill these details to change pending tasks into done.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (vendor?.vendorProfile?.status !== "APPROVED") {
                setShowPendingProfileEditor(false);
                return;
              }

              openSection("dashboard");
            }}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
          >
            {vendor?.vendorProfile?.status !== "APPROVED"
              ? "Back to Approval Status"
              : "Back to Dashboard"}
          </button>
        </div>

        {activeSection === "payments" && (
          <div className="mb-5 rounded-2xl border border-pink-100 bg-pink-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h3 className="font-bold text-pink-900">Payout dashboard</h3>
                <p className="text-sm text-pink-800">
                  View available balance, ledger, bank verification, payout history and settlement reports.
                </p>
              </div>
              <Link
                href="/vendor/dashboard/payouts"
                className="rounded-xl bg-pink-600 px-4 py-3 text-center text-sm font-bold text-white"
              >
                Open Payouts
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={saveProfile} className="space-y-6">
          <div>
            <h3 className="mb-3 font-semibold">Basic Details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                name="name"
                value={profileForm.name}
                onChange={handleFormChange}
                placeholder="Name"
                className="rounded-xl border p-3"
              />
              <input
                value={vendor?.email || ""}
                placeholder="Email"
                className="rounded-xl border bg-gray-50 p-3 text-gray-500"
                disabled
              />
              <input
                name="mobile"
                value={profileForm.mobile}
                onChange={handleFormChange}
                placeholder="Mobile number"
                className="rounded-xl border p-3"
              />
              <input
                name="logoUrl"
                value={profileForm.logoUrl}
                onChange={handleFormChange}
                placeholder="Logo / shop image URL"
                className="rounded-xl border p-3"
              />
              <div className="md:col-span-2">
                <FileUploadField
                  label="Upload logo / shop image"
                  purpose="vendor-logo"
                  accept="image/*"
                  onUploaded={(url) => setProfileField("logoUrl", url)}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold">Business Details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                name="storeName"
                value={profileForm.storeName}
                onChange={handleFormChange}
                placeholder="Business name"
                className="rounded-xl border p-3"
              />
              <input
                name="businessCategory"
                value={profileForm.businessCategory}
                onChange={handleFormChange}
                placeholder="Business category"
                className="rounded-xl border p-3"
              />
              <input
                name="workingHours"
                value={profileForm.workingHours}
                onChange={handleFormChange}
                placeholder="Working hours"
                className="rounded-xl border p-3"
              />
              <input
                name="deliveryArea"
                value={profileForm.deliveryArea}
                onChange={handleFormChange}
                placeholder="Delivery/service area"
                className="rounded-xl border p-3"
              />
              <textarea
                name="description"
                value={profileForm.description}
                onChange={handleFormChange}
                placeholder="Business description"
                className="min-h-28 rounded-xl border p-3 md:col-span-2"
              />
              <textarea
                name="businessAddress"
                value={profileForm.businessAddress}
                onChange={handleFormChange}
                placeholder="Business address"
                className="min-h-24 rounded-xl border p-3 md:col-span-2"
              />
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold">Payments and KYC</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                name="gstNumber"
                value={profileForm.gstNumber}
                onChange={handleFormChange}
                placeholder="GST number, if needed"
                className="rounded-xl border p-3"
              />
              <input
                name="panNumber"
                value={profileForm.panNumber}
                onChange={handleFormChange}
                placeholder="PAN number"
                className="rounded-xl border p-3"
              />
              <input
                name="aadhaarNumber"
                value={profileForm.aadhaarNumber}
                onChange={handleFormChange}
                placeholder="Aadhaar number"
                className="rounded-xl border p-3"
              />
              <input
                name="upiId"
                value={profileForm.upiId}
                onChange={handleFormChange}
                placeholder="UPI ID"
                className="rounded-xl border p-3"
              />
              <textarea
                name="bankDetails"
                value={profileForm.bankDetails}
                onChange={handleFormChange}
                placeholder="Bank details"
                className="min-h-24 rounded-xl border p-3"
              />
              <textarea
                name="documentsKyc"
                value={profileForm.documentsKyc}
                onChange={handleFormChange}
                placeholder="KYC notes or extra document link"
                className="min-h-24 rounded-xl border p-3"
              />
              <input
                name="panCardUrl"
                value={profileForm.panCardUrl}
                onChange={handleFormChange}
                placeholder="PAN card document URL"
                className="rounded-xl border p-3"
              />
              <FileUploadField
                label="Upload PAN card"
                purpose="kyc"
                onUploaded={(url) => setProfileField("panCardUrl", url)}
              />
              <input
                name="aadhaarUrl"
                value={profileForm.aadhaarUrl}
                onChange={handleFormChange}
                placeholder="Aadhaar document URL"
                className="rounded-xl border p-3"
              />
              <FileUploadField
                label="Upload Aadhaar"
                purpose="kyc"
                onUploaded={(url) => setProfileField("aadhaarUrl", url)}
              />
              <input
                name="gstCertificateUrl"
                value={profileForm.gstCertificateUrl}
                onChange={handleFormChange}
                placeholder="GST certificate URL"
                className="rounded-xl border p-3"
              />
              <FileUploadField
                label="Upload GST certificate"
                purpose="kyc"
                onUploaded={(url) => setProfileField("gstCertificateUrl", url)}
              />
              <input
                name="bankProofUrl"
                value={profileForm.bankProofUrl}
                onChange={handleFormChange}
                placeholder="Bank proof URL"
                className="rounded-xl border p-3"
              />
              <FileUploadField
                label="Upload bank proof"
                purpose="kyc"
                onUploaded={(url) => setProfileField("bankProofUrl", url)}
              />
            </div>
          </div>

          {saveMessage && (
            <p
              className={`rounded-xl p-3 text-sm ${
                saveMessage.includes("saved")
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {saveMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="rounded-xl bg-pink-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {savingProfile ? "Saving..." : "Save Profile Details"}
          </button>
        </form>
      </section>
    );
  }

  function renderOrdersSection() {
    return (
      <section className="rounded-2xl bg-white shadow">
        <div className="border-b px-5 py-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">Orders</h2>
              <p className="text-sm text-gray-500">
                Process customer orders from payment to delivery.
              </p>
            </div>
            <Link
              href="/vendor/dashboard/upload"
              className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Add More Products
            </Link>
          </div>
          {orderMessage && (
            <p
              className={`mt-3 rounded-xl p-3 text-sm ${
                orderMessage.includes("updated")
                  || orderMessage.toLowerCase().includes("saved")
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {orderMessage}
            </p>
          )}
        </div>

        <datalist id="vendor-courier-companies">
          {courierCompanies.map((company) => (
            <option key={company} value={company} />
          ))}
        </datalist>

        {orders.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-500">
            No orders yet. New checkout orders will appear here automatically.
          </div>
        ) : (
          <div className="divide-y">
            {orders.map((order) => {
              const courierSaved = Boolean(order.carrier && order.trackingNumber);
              return (
              <article key={order.id} className="p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">Order #{order.id.slice(-8)}</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusTone(order.status)}`}
                      >
                        {order.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(order.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      {order.user?.name || order.shippingName || "Customer"} /{" "}
                      {order.user?.email || "Email not available"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Phone: {order.shippingPhone || "Not saved"}
                    </p>
                    <p className="mt-1 max-w-2xl text-sm text-gray-600">
                      Address:{" "}
                      {[
                        order.shippingAddress,
                        order.shippingCity,
                        order.shippingState,
                        order.shippingZipCode,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Not saved"}
                    </p>
                    {order.statusNote && (
                      <p className="mt-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                        {order.statusNote}
                      </p>
                    )}
                  </div>

                  <div className="min-w-56 text-left lg:text-right">
                    <p className="text-2xl font-bold text-pink-600">
                      Rs. {Number(order.totalAmount || 0).toFixed(2)}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {order.paymentMethod} / {order.paymentId || "Payment pending"}
                    </p>
                    {order.trackingNumber && (
                      <p className="mt-1 text-sm font-semibold text-purple-700">
                        {order.carrier || "Tracking"}: {order.trackingNumber}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          item.product?.images?.[0] ||
                          "/product-placeholder.svg"
                        }
                        alt={item.product?.name || "Product"}
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {item.product?.name || item.productId}
                        </p>
                        <p className="text-sm text-gray-500">
                          Qty {item.quantity} x Rs. {Number(item.price).toFixed(2)}
                        </p>
                        {(item.sizeLabel || item.numericSize || item.variantColor || item.variantSku) && (
                          <p className="text-xs font-semibold text-blue-700">
                            {[item.sizeLabel, item.numericSize && `Size ${item.numericSize}`, item.variantColor, item.variantSku && `SKU ${item.variantSku}`]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        )}
                        <p className="text-xs text-green-700">
                          Payout Rs. {Number(item.vendorPayout || item.vendorPrice || item.price).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Packaging Rs. {Number(item.packagingCharge || 0).toFixed(2)}
                        </p>
                        {item.product?.sku && (
                          <p className="text-xs text-gray-400">SKU: {item.product.sku}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {["PENDING", "PAID", "SHIPPED"].includes(order.status) && (
                  <div className="mt-4 grid gap-3 rounded-xl border border-purple-100 bg-purple-50 p-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <p className="text-sm font-black text-purple-950">
                        Step 1: Save courier details first
                      </p>
                      <p className="mt-1 text-xs font-semibold text-purple-800">
                        Save courier/AWB, print the 4x6 shipping label, then upload product, packed product and shipping label proof before dispatch.
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.16em] text-purple-700">
                        Courier company
                      </label>
                      <input
                        list="vendor-courier-companies"
                        value={carriers[order.id] ?? order.carrier ?? ""}
                        onChange={(event) =>
                          setCarriers((current) => ({
                            ...current,
                            [order.id]: event.target.value,
                          }))
                        }
                        placeholder="Select or type courier company"
                        className="mt-2 w-full rounded-xl border border-purple-200 bg-white p-3 text-sm outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.16em] text-purple-700">
                        Tracking / AWB number
                      </label>
                      <input
                        value={trackingNumbers[order.id] ?? order.trackingNumber ?? ""}
                        onChange={(event) =>
                          setTrackingNumbers((current) => ({
                            ...current,
                            [order.id]: event.target.value,
                          }))
                        }
                        placeholder="Enter tracking number"
                        className="mt-2 w-full rounded-xl border border-purple-200 bg-white p-3 text-sm outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                      <button
                        type="button"
                        onClick={() => saveCourierDetails(order)}
                        disabled={updatingOrderId === order.id}
                        className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {courierSaved ? "Update Courier Details" : "Save Courier Details"}
                      </button>
                      {courierSaved && (
                        <Link
                          href={`/order/${order.id}/shipping-label`}
                          target="_blank"
                          className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-purple-800 ring-1 ring-purple-200"
                        >
                          Print / Download Shipping Label
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {["PENDING", "PAID", "SHIPPED"].includes(order.status) && (
                  <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                      <div>
                        <p className="text-sm font-bold text-blue-950">
                          Dispatch Verification Proof
                        </p>
                        <p className="mt-1 text-xs text-blue-800">
                          Required before shipping. Customer will see this as
                          Product Packed Proof.
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-900">
                        {order.trust?.verification?.verificationId ||
                          "ID after shipping"}
                      </span>
                    </div>

                    {!courierSaved ? (
                      <div className="mt-4 rounded-xl bg-white p-4 text-sm font-semibold text-blue-900">
                        Step 2 is locked. First save courier company and tracking/AWB number, then print/download the shipping label and upload dispatch proof here.
                      </div>
                    ) : order.trust?.dispatchImages?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {order.trust.dispatchImages.slice(0, 6).map((image) => (
                          <a
                            key={image.id}
                            href={image.url}
                            target="_blank"
                            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-900"
                          >
                            {image.imageType}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <FileUploadField
                          label={`Product images (${(dispatchProductImages[order.id] || []).length})`}
                          purpose="dispatch-proof"
                          accept="image/*"
                          onUploaded={(url) =>
                            setDispatchProductImages((current) => ({
                              ...current,
                              [order.id]: [...(current[order.id] || []), url],
                            }))
                          }
                        />
                        <FileUploadField
                          label={`Packed images (${(dispatchPackedImages[order.id] || []).length})`}
                          purpose="dispatch-proof"
                          accept="image/*"
                          onUploaded={(url) =>
                            setDispatchPackedImages((current) => ({
                              ...current,
                              [order.id]: [...(current[order.id] || []), url],
                            }))
                          }
                        />
                        <FileUploadField
                          label={
                            shippingLabelImages[order.id]
                              ? "Shipping label uploaded"
                              : "Shipping label image"
                          }
                          purpose="dispatch-proof"
                          accept="image/*,application/pdf"
                          onUploaded={(url) =>
                            setShippingLabelImages((current) => ({
                              ...current,
                              [order.id]: url,
                            }))
                          }
                        />
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-blue-950">
                      <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 font-semibold">
                        <input
                          type="checkbox"
                          checked={Boolean(openBoxOrders[order.id])}
                          onChange={(event) =>
                            setOpenBoxOrders((current) => ({
                              ...current,
                              [order.id]: event.target.checked,
                            }))
                          }
                        />
                        Open box delivery eligible
                      </label>
                      {order.trust?.deliveryOtp && !order.trust.deliveryOtp.verified && (
                        <span className="rounded-xl bg-white px-3 py-2 font-semibold">
                          Customer OTP required at delivery
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {order.status === "SHIPPED" && (
                  <div className="mt-4 rounded-xl border border-green-100 bg-green-50 p-4">
                    <label className="text-xs font-bold uppercase tracking-[0.16em] text-green-800">
                      Delivery OTP from customer
                    </label>
                    <input
                      value={deliveryOtps[order.id] || ""}
                      onChange={(event) =>
                        setDeliveryOtps((current) => ({
                          ...current,
                          [order.id]: event.target.value,
                        }))
                      }
                      placeholder="Enter customer OTP before marking delivered"
                      className="mt-2 w-full rounded-xl border border-green-200 bg-white p-3 text-sm outline-none focus:border-green-600"
                    />
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {order.status === "PENDING" && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(order, "PAID")}
                      disabled={updatingOrderId === order.id}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Confirm Payment
                    </button>
                  )}
                  {["PENDING", "PAID"].includes(order.status) && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(order, "SHIPPED")}
                      disabled={updatingOrderId === order.id || !courierSaved}
                      className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {courierSaved ? "Mark Shipped" : "Save Courier First"}
                    </button>
                  )}
                  {order.status === "SHIPPED" && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(order, "DELIVERED")}
                      disabled={updatingOrderId === order.id}
                      className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Mark Delivered
                    </button>
                  )}
                  {!["DELIVERED", "CANCELLED", "RETURNED"].includes(order.status) && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(order, "CANCELLED")}
                      disabled={updatingOrderId === order.id}
                      className="rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  )}
                  <Link
                    href={`/order/${order.id}`}
                    className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
                  >
                    View Customer Page
                  </Link>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  function renderInfoPanel() {
    if (
      activeSection === "profile" ||
      activeSection === "business" ||
      activeSection === "payments" ||
      activeSection === "kyc" ||
      activeSection === "settings"
    ) {
      return renderProfileForm();
    }

    if (activeSection === "products") {
      return (
        <section className="rounded-2xl bg-white p-5 shadow">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">My Store</h2>
              <p className="text-sm text-gray-500">
                Manage your listed products here. Use Stock Management when only quantity, MOQ, or low-stock settings need to change.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/vendor/dashboard/upload"
                className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Add Product
              </Link>
              <Link
                href="/vendor/dashboard/inventory"
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
              >
                Update Stock
              </Link>
            </div>
          </div>
        </section>
      );
    }

    if (activeSection === "inventory") {
      return (
        <section className="rounded-2xl bg-white p-5 shadow">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">Stock Management</h2>
              <p className="text-sm text-gray-500">
                Add stock, reduce stock, set MOQ, maximum quantity, low-stock alerts, pre-order, and backorder rules.
              </p>
            </div>
            <Link
              href="/vendor/dashboard/inventory"
              className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Open Stock Management
            </Link>
          </div>
        </section>
      );
    }

    if (activeSection === "orders") {
      return renderOrdersSection();
    }

    if (activeSection === "dashboard") {
      return null;
    }

    if (activeSection === "notifications") {
      return (
        <section className="rounded-2xl bg-white p-5 shadow">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">Notifications</h2>
              <p className="text-sm text-gray-500">
                Admin reminders, payout updates, low-stock alerts, and order messages appear here.
              </p>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => markNotificationsRead()}
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="mt-5 space-y-3">
            {notifications.length === 0 ? (
              <p className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => markNotificationsRead(notification.id)}
                  className={`w-full rounded-xl border p-4 text-left text-sm ${
                    notification.read
                      ? "border-gray-200 bg-gray-50 text-gray-600"
                      : "border-pink-200 bg-pink-50 text-gray-900"
                  }`}
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <p className="font-bold">{notification.title}</p>
                      <p className="mt-1">{notification.message}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {new Date(notification.createdAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      );
    }

    return (
      <section className="rounded-2xl bg-white p-5 shadow">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">{sectionTitles[activeSection]}</h2>
            <p className="text-sm text-gray-500">
              This workspace is ready for your next vendor workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openSection("dashboard")}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="mt-6 rounded-xl bg-gray-50 p-5 text-sm text-gray-600">
          {activeSection === "customers" &&
            "Customer details will appear here after orders are placed."}
          {activeSection === "messages" &&
            "Customer and support messages will appear here."}
          {activeSection === "offers" &&
            "Offer and coupon tools can be added here."}
          {activeSection === "reviews" &&
            "Product reviews and ratings will appear here."}
          {activeSection === "reports" &&
            "Sales and inventory reports will appear here."}
          {activeSection === "support" &&
            "For support, add your issue details in the profile support notes or contact admin."}
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">Loading vendor dashboard...</p>
      </main>
    );
  }

  if (message) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
          <h1 className="text-2xl font-bold">Vendor Access Needed</h1>
          <p className="mt-3 text-gray-600">{message}</p>
          <Link
            href={message.includes("register") ? "/vendor/register" : "/login"}
            className="mt-5 inline-block rounded-xl bg-pink-600 px-5 py-3 font-semibold text-white"
          >
            {message.includes("register") ? "Register as Vendor" : "Login"}
          </Link>
        </div>
      </main>
    );
  }

  if (agreementRequired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-600">
            Vendor agreement update required
          </p>
          <h1 className="mt-3 text-3xl font-bold">Accept latest Zylo-Buylo Vendor Agreement</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Your dashboard is protected until the current agreement version is accepted.
            This keeps product quality, dispatch proof, COD payout, return review,
            compliance and legal responsibility rules clear for every vendor.
          </p>
          <div className="mt-5 rounded-xl bg-pink-50 p-4 text-sm text-gray-800">
            <p className="font-bold">Current version: {VENDOR_AGREEMENT_VERSION}</p>
            <p className="mt-2">
              By accepting, you confirm that you have read the latest vendor agreement
              and will follow Zylo-Buylo marketplace, product, compliance, COD, payout
              and return rules.
            </p>
          </div>
          {saveMessage && (
            <p className="mt-4 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-800">
              {saveMessage}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/vendor-agreement"
              target="_blank"
              className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-bold"
            >
              Read full agreement
            </Link>
            <button
              type="button"
              onClick={acceptLatestAgreement}
              disabled={acceptingAgreement}
              className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {acceptingAgreement ? "Accepting..." : "I have read and accept"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-gray-100 px-5 py-3 text-sm font-bold"
            >
              Logout
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (vendor && vendor.vendorProfile?.status !== "APPROVED") {
    const vendorProfile = vendor.vendorProfile;
    const status = vendorProfile?.status || "PENDING";

    if (showPendingProfileEditor) {
      return (
        <main className="min-h-screen bg-gray-100 p-6">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-600">
                Vendor approval
              </p>
              <h1 className="mt-2 text-2xl font-bold">
                Update profile and KYC details
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Save missing details here, then ask admin to approve this vendor
                from the admin vendor page.
              </p>
            </div>
            {renderProfileForm()}
          </div>
        </main>
      );
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-600">
                Vendor approval
              </p>
              <h1 className="mt-3 text-3xl font-bold">
                {status === "REJECTED"
                  ? "Vendor application rejected"
                  : status === "INACTIVE"
                    ? "Vendor account inactive"
                    : "Waiting for admin approval"}
              </h1>
              <p className="mt-3 text-gray-600">
                Your dashboard, product upload, and vendor products will unlock
                after admin approves your KYC and business details.
              </p>
              {vendorProfile?.rejectionReason && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {vendorProfile.rejectionReason}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowPendingProfileEditor(true)}
              className="rounded-full bg-yellow-100 px-4 py-2 text-sm font-bold text-yellow-800 transition hover:bg-yellow-200"
              title="Click to update missing profile and KYC details"
            >
              {status}
            </button>
          </div>

          <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
            <p>
              <span className="font-semibold">Business:</span>{" "}
              {vendorProfile?.storeName || "Not set"}
            </p>
            <p>
              <span className="font-semibold">KYC:</span>{" "}
              {vendorProfile?.kycStatus || "NOT_SUBMITTED"}
            </p>
            <p>
              <span className="font-semibold">PAN:</span>{" "}
              {vendorProfile?.panNumber || "Not set"}
            </p>
            <p>
              <span className="font-semibold">GST:</span>{" "}
              {vendorProfile?.gstNumber || "Not set"}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl border px-5 py-3 text-sm font-semibold"
            >
              Go Home
            </Link>
            <button
              type="button"
              onClick={() => setShowPendingProfileEditor(true)}
              className="rounded-xl border border-pink-200 px-5 py-3 text-sm font-semibold text-pink-700"
            >
              Update Profile / KYC
            </button>
            <Link
              href="/admin/vendors?status=PENDING"
              className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"
            >
              Admin Approval Page
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-semibold text-white"
            >
              Refresh After Approval
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-gray-100">
      <div className="grid min-h-screen lg:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="hidden border-r bg-white lg:block">
          <div className="border-b p-4">
            <Link href="/" className="text-xl font-bold text-pink-600">
              ZYLO BUYLO
            </Link>
            <p className="mt-1 text-sm text-gray-500">
              {adminPreview ? "Admin Preview" : "Vendor Panel"}
            </p>
          </div>

          <nav className="space-y-1 p-3">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() =>
                  item.href ? router.push(item.href) : openSection(item.section)
                }
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  activeSection === item.section
                    ? "bg-pink-50 font-semibold text-pink-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 border-b bg-white/95 px-4 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 overflow-hidden">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-gray-900 md:text-2xl">
                  Welcome, {vendorName}
                </h1>
                <p className="truncate text-sm text-gray-500">{businessName}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => openSection("notifications")}
                  className="rounded-full border px-3 py-2 text-sm font-semibold"
                >
                  Notifications{unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}
                </button>

                {adminPreview && (
                  <Link
                    href="/admin/vendors"
                    className="rounded-full border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-800"
                  >
                    Back to Vendors
                  </Link>
                )}

                <div className="relative">
                  <button
                    onClick={() => setProfileOpen((open) => !open)}
                    className="rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Profile
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border bg-white shadow-xl">
                      <div className="border-b px-4 py-3">
                        <p className="font-semibold">{vendorName}</p>
                        <p className="text-xs text-gray-500">{vendor?.email}</p>
                      </div>

                      {profileMenuItems.map((item) => (
                        <button
                          key={item.label}
                          onClick={() => openSection(item.section)}
                          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {item.label}
                        </button>
                      ))}

                      {!adminPreview && (
                        <button
                          onClick={handleLogout}
                          className="block w-full border-t px-4 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          Logout
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-5">
            {adminPreview && (
              <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                <p className="font-bold">Admin read-only vendor dashboard preview</p>
                <p className="mt-1">
                  You are viewing {businessName} as admin. Vendor-only actions like profile save,
                  upload and inventory edits stay disabled from this preview.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {statCards.map((card) => (
                <button
                  key={card.label}
                  onClick={() =>
                    card.label === "Notifications"
                      ? openSection("notifications")
                      : undefined
                  }
                  className="min-w-0 rounded-2xl bg-white p-4 text-left shadow"
                >
                  <p className="truncate text-sm text-gray-500">{card.label}</p>
                  <p className={`mt-2 truncate text-2xl font-bold ${card.tone}`}>
                    {card.value}
                  </p>
                </button>
              ))}
            </div>

            {renderInfoPanel()}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-5">
                <section className="rounded-2xl bg-white p-5 shadow">
                  <div className="mb-4">
                    <h2 className="text-xl font-bold">Quick Actions</h2>
                    <p className="text-sm text-gray-500">
                      Common vendor actions in one place.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!adminPreview && (
                      <Link
                        href="/vendor/dashboard/upload"
                        className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Add Product / Service
                      </Link>
                    )}
                    <button
                      onClick={() => openSection("orders")}
                      className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
                    >
                      View Orders
                    </button>
                    {!adminPreview && (
                      <Link
                        href="/vendor/dashboard/inventory"
                        className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
                      >
                        Update Availability
                      </Link>
                    )}
                    <button
                      onClick={() => openSection("payments")}
                      className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
                    >
                      Check Payments
                    </button>
                    <button
                      onClick={() => openSection("support")}
                      className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
                    >
                      Contact Support
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl bg-white shadow">
                  <div className="border-b px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold">Recent Orders</h2>
                        <p className="text-sm text-gray-500">
                          Latest customer orders that need attention.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openSection("orders")}
                        className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
                      >
                        View All
                      </button>
                    </div>
                  </div>
                  {orders.length === 0 ? (
                    <div className="px-5 py-10 text-center text-gray-500">
                      No recent orders yet.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {orders.slice(0, 4).map((order) => (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => openSection("orders")}
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50"
                        >
                          <div>
                            <p className="font-semibold">
                              Order #{order.id.slice(-8)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {order.items.length} item
                              {order.items.length === 1 ? "" : "s"} /{" "}
                              {order.user?.name || order.shippingName || "Customer"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-pink-600">
                              Rs. {Number(order.totalAmount || 0).toFixed(2)}
                            </p>
                            <span
                              className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold ${getStatusTone(order.status)}`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl bg-white shadow">
                  <div className="border-b px-5 py-4">
                    <h2 className="text-xl font-bold">My Products / Services</h2>
                    <p className="text-sm text-gray-500">
                      Total stock: {totalStock}
                    </p>
                  </div>

                  {products.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="mb-4 text-gray-600">No products added yet.</p>
                      <Link
                        href="/vendor/dashboard/upload"
                        className="inline-block rounded-xl bg-pink-600 px-5 py-2 text-white"
                      >
                        Add First Product
                      </Link>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            {[
                              "Product",
                              "Category",
                              "Subcategory",
                              "SKU",
                              "Price",
                              "Stock",
                              "Status",
                            ].map((heading) => (
                              <th
                                key={heading}
                                className="px-5 py-3 text-left text-sm font-semibold"
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((product) => (
                            <tr key={product.id} className="border-t">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={
                                      product.images?.[0] ||
                                      "/product-placeholder.svg"
                                    }
                                    alt={product.name}
                                    className="h-14 w-14 rounded-lg object-cover"
                                  />
                                  <div>
                                    <p className="font-semibold">
                                      {product.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {product.createdAt
                                        ? new Date(
                                            product.createdAt
                                          ).toLocaleDateString()
                                        : ""}
                                    </p>
                                    {product.variants?.length ? (
                                      <div className="mt-2 flex max-w-sm flex-wrap gap-1">
                                        {product.variants.slice(0, 8).map((variant) => (
                                          <span
                                            key={variant.id}
                                            className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                                              variant.status === "OUT_OF_STOCK"
                                                ? "bg-gray-200 text-gray-700"
                                                : variant.status === "LOW_STOCK"
                                                  ? "bg-orange-100 text-orange-800"
                                                  : "bg-green-100 text-green-800"
                                            }`}
                                          >
                                            {[variant.sizeLabel, variant.numericSize, variant.color]
                                              .filter(Boolean)
                                              .join("/")}
                                            : {variant.stockQuantity}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <p>
                                  {product.category?.name ||
                                    getCategoryName(product.category?.id)}
                                </p>
                              </td>
                              <td className="px-5 py-4">
                                {product.subcategory?.name || "Not selected"}
                              </td>
                              <td className="px-5 py-4">
                                {product.sku || "No SKU"}
                              </td>
                              <td className="px-5 py-4">
                                <p className="font-semibold text-pink-600">
                                  {formatRupees(product.price)}
                                </p>
                                {product.mrp && product.mrp > product.price && (
                                  <p className="text-xs text-gray-500">
                                    <span className="line-through">
                                      {formatRupees(product.mrp)}
                                    </span>{" "}
                                    <span className="font-semibold text-green-700">
                                      {product.discountPercent || 0}% off
                                    </span>
                                  </p>
                                )}
                                <p className="text-xs text-gray-500">
                                  Payout {formatRupees(product.vendorPayout || product.vendorPrice || product.price)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Packaging {formatRupees(product.packagingCharge || 0)}
                                </p>
                              </td>
                              <td className="px-5 py-4">
                                {product.inventory || 0}
                              </td>
                              <td className="px-5 py-4">
                                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                  Active
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-2xl bg-white p-5 shadow">
                  <h2 className="text-xl font-bold">Alerts</h2>
                  <div className="mt-4 space-y-3 text-sm">
                    {pendingTasks.length > 0 ? (
                      <button
                        onClick={() => openSection(pendingTasks[0].section)}
                        className="w-full rounded-xl bg-pink-50 p-3 text-left text-pink-800"
                      >
                        Complete vendor profile and KYC details.
                      </button>
                    ) : (
                      <p className="rounded-xl bg-green-50 p-3 text-green-800">
                        No critical alerts right now.
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-5 shadow">
                  <h2 className="text-xl font-bold">Pending Tasks</h2>
                  <div className="mt-4 max-h-[420px] space-y-2 overflow-auto">
                    {profileTasks.map((task) => (
                      <div
                        key={task.label}
                        className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm"
                      >
                        <span>{task.label}</span>
                        <button
                          onClick={() => openSection(task.section)}
                          className={
                            task.done
                              ? "font-semibold text-green-600"
                              : "font-semibold text-yellow-700"
                          }
                        >
                          {task.done ? "Done" : "Pending"}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-5 shadow">
                  <h2 className="text-xl font-bold">Support</h2>
                  <p className="mt-2 text-sm text-gray-500">
                    Need help with products, KYC, payments, or orders?
                  </p>
                  <button
                    onClick={() => openSection("support")}
                    className="mt-4 w-full rounded-xl bg-black px-4 py-3 font-semibold text-white"
                  >
                    Contact Support
                  </button>
                </section>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
