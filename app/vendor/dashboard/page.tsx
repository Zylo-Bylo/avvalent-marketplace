"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  price: number;
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
};

type Category = {
  id: string;
  name: string;
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
  bankDetails?: string | null;
  upiId?: string | null;
  documentsKyc?: string | null;
  workingHours?: string | null;
  deliveryArea?: string | null;
};

type VendorUser = {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
  vendorProfile?: VendorProfile | null;
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

type ProfileForm = {
  name: string;
  storeName: string;
  description: string;
  logoUrl: string;
  mobile: string;
  businessCategory: string;
  businessAddress: string;
  gstNumber: string;
  bankDetails: string;
  upiId: string;
  documentsKyc: string;
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
  bankDetails: "",
  upiId: "",
  documentsKyc: "",
  workingHours: "",
  deliveryArea: "",
};

const sidebarItems: Array<{ label: string; section: DashboardSection }> = [
  { label: "Dashboard", section: "dashboard" },
  { label: "Orders", section: "orders" },
  { label: "Products / Services", section: "products" },
  { label: "Inventory", section: "inventory" },
  { label: "Customers", section: "customers" },
  { label: "Messages", section: "messages" },
  { label: "Payments & Wallet", section: "payments" },
  { label: "Offers / Coupons", section: "offers" },
  { label: "Reviews & Ratings", section: "reviews" },
  { label: "Reports / Analytics", section: "reports" },
  { label: "Business Profile", section: "business" },
  { label: "Documents / KYC", section: "kyc" },
  { label: "Support", section: "support" },
  { label: "Settings", section: "settings" },
];

const profileMenuItems: Array<{ label: string; section: DashboardSection }> = [
  { label: "My Profile", section: "profile" },
  { label: "Business Details", section: "business" },
  { label: "My Products / Services", section: "products" },
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
  products: "Products / Services",
  orders: "Orders",
  inventory: "Inventory",
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
    bankDetails: profile?.bankDetails || "",
    upiId: profile?.upiId || "",
    documentsKyc: profile?.documentsKyc || "",
    workingHours: profile?.workingHours || "",
    deliveryArea: profile?.deliveryArea || "",
  };
}

export default function VendorDashboardPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] =
    useState<DashboardSection>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendor, setVendor] = useState<VendorUser | null>(null);
  const [profileForm, setProfileForm] =
    useState<ProfileForm>(emptyProfileForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadDashboard() {
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

      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch("/api/vendor/products", { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
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

      if (categoriesResponse.ok) {
        const data = await categoriesResponse.json();
        setCategories(data.categories || []);
      }

      setLoading(false);
    }

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  const vendorName = vendor?.name || "Vendor";
  const businessName = vendor?.vendorProfile?.storeName || "Your Business";
  const approvedProducts = products.length;
  const totalStock = products.reduce(
    (sum, product) => sum + Number(product.inventory || 0),
    0
  );

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
        done: Boolean(vendor?.vendorProfile?.documentsKyc),
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
    { label: "Today's Orders", value: "0", tone: "text-blue-600" },
    { label: "Pending Orders", value: "0", tone: "text-yellow-600" },
    { label: "Completed Orders", value: "0", tone: "text-green-600" },
    { label: "Total Sales", value: "Rs. 0", tone: "text-pink-600" },
    { label: "Pending Payments", value: "Rs. 0", tone: "text-red-600" },
    {
      label: "Product/Service Listings",
      value: products.length,
      tone: "text-purple-600",
    },
    { label: "Customer Messages", value: "0", tone: "text-indigo-600" },
    { label: "Ratings & Reviews", value: "0.0", tone: "text-amber-600" },
    {
      label: "Notifications",
      value: pendingTasks.length,
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

  function openSection(section: DashboardSection) {
    setActiveSection(section);
    setProfileOpen(false);
    setSaveMessage("");
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

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveMessage("");
    setSavingProfile(true);

    const response = await fetch("/api/vendor/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileForm),
    });

    const data = await response.json();
    setSavingProfile(false);

    if (!response.ok) {
      setSaveMessage(data.error || "Could not save profile details.");
      return;
    }

    setVendor(data.user);
    setProfileForm(formFromVendor(data.user));
    setSaveMessage("Profile details saved. Pending task status updated.");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
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
            onClick={() => openSection("dashboard")}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
          >
            Back to Dashboard
          </button>
        </div>

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
                placeholder="Documents / KYC details or document link"
                className="min-h-24 rounded-xl border p-3"
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

    if (activeSection === "products" || activeSection === "inventory") {
      return null;
    }

    if (activeSection === "dashboard") {
      return null;
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
          {activeSection === "orders" &&
            "Orders from customers will appear here after checkout."}
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
          {activeSection === "notifications" &&
            `${pendingTasks.length} profile task(s) still need attention.`}
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

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r bg-white lg:block">
          <div className="border-b p-5">
            <Link href="/" className="text-2xl font-bold text-pink-600">
              ZYLO BUYLO
            </Link>
            <p className="mt-1 text-sm text-gray-500">Vendor Panel</p>
          </div>

          <nav className="space-y-1 p-4">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => openSection(item.section)}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm transition ${
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

        <section>
          <header className="sticky top-0 z-20 border-b bg-white/95 px-4 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome, {vendorName}
                </h1>
                <p className="text-sm text-gray-500">{businessName}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => openSection("notifications")}
                  className="rounded-full border px-4 py-2 text-sm font-semibold"
                >
                  Notifications
                </button>

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

                      <button
                        onClick={handleLogout}
                        className="block w-full border-t px-4 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {statCards.map((card) => (
                <button
                  key={card.label}
                  onClick={() =>
                    card.label === "Notifications"
                      ? openSection("notifications")
                      : undefined
                  }
                  className="rounded-2xl bg-white p-5 text-left shadow"
                >
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className={`mt-2 text-3xl font-bold ${card.tone}`}>
                    {card.value}
                  </p>
                </button>
              ))}
            </div>

            {renderInfoPanel()}

            <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
              <div className="space-y-6">
                <section className="rounded-2xl bg-white p-5 shadow">
                  <div className="mb-4">
                    <h2 className="text-xl font-bold">Quick Actions</h2>
                    <p className="text-sm text-gray-500">
                      Common vendor actions in one place.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/vendor/dashboard/upload"
                      className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Add Product / Service
                    </Link>
                    <button
                      onClick={() => openSection("orders")}
                      className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
                    >
                      View Orders
                    </button>
                    <button
                      onClick={() => openSection("inventory")}
                      className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold"
                    >
                      Update Availability
                    </button>
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
                    <h2 className="text-xl font-bold">Recent Orders</h2>
                    <p className="text-sm text-gray-500">
                      Orders will appear here after customers start buying.
                    </p>
                  </div>
                  <div className="px-5 py-10 text-center text-gray-500">
                    No recent orders yet.
                  </div>
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
                                      "https://placehold.co/100x100/png?text=No+Image"
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
                              <td className="px-5 py-4 font-semibold text-pink-600">
                                Rs. {product.price}
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
