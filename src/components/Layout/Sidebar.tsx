import { API_ENDPOINTS } from '../../config/apiConfig';
// Sidebar.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Home,
  Building,
  DollarSign,
  Users,
  BarChart3,
  X,
  LogOut,
  Settings,
  ChevronDown,
  ChevronRight,
  Percent,
  Package,
  History,
  ClipboardList,
  FileText,
  TrendingUp,
  UserCheck,
  Globe,
  Briefcase,
  Award,
  Calendar,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
}

type MenuSubChild = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number }>;
};

type MenuChild = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number }>;
  children?: MenuSubChild[];
};

type MenuItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  children?: MenuChild[];
};

const CHANGE_PASSWORD_URL =
  API_ENDPOINTS.ADMIN_USER_PWD_SET;

const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onPageChange,
  isMobileMenuOpen,
  toggleMobileMenu,
}) => {
  const { logout, user } = useAuth();

  // ✅ User role from localStorage
  const isAccountUser =
    String(localStorage.getItem("account") || "").trim().toUpperCase() === "Y";

  // ✅ Menu items
  const menuItems: MenuItem[] = useMemo(() => {
    const HIDE_RENTAL_AND_SALES = true; // ✅ set false to show again

    const items: MenuItem[] = [
      { id: "dashboard", label: "Dashboard", icon: Home },

      
      

      { id: "listing", label: "Listing", icon: Building },

      { id: "rental", label: "Rental", icon: Building },
      { id: "sale-purchase", label: "Sale & Purchase", icon: DollarSign },

      ...(!isAccountUser
        ? [
            {
              id: "reports/comm-payout-ren",
              label: "Commission Payout",
              icon: DollarSign,
            } as MenuItem,
          ]
        : []),
      
      ...(isAccountUser
        ? [
            {
              id: "reports/pending-comm-payout",
              label: "Pending Commission Payout",
              icon: Package,
            } as MenuItem,
          ]
        : []),

      ...(isAccountUser
        ? [
            {
              id: "reports/pending-overriding-comm-payout",
              label: "Pending Overriding Commission Payout",
              icon: Package,
            } as MenuItem,
          ]
        : []),

      ...(isAccountUser
        ? ([{ id: "inventory", label: "Inventory", icon: Package }] as MenuItem[])
        : []),

      { id: "inventory-trans", label: "Petty Cash", icon: History },

      ...(isAccountUser
        ? ([
            {
              id: "staff-setup",
              label: "Staff Setup",
              icon: Users,
              children: [
                {
                  id: "staff-setup/ren-individual",
                  label: "REN Individual %",
                  icon: Percent,
                },
                { id: "staff-setup/admin", label: "Admin", icon: Settings },
              ],
            },
          ] as MenuItem[])
        : []),

      ...(isAccountUser
        ? ([
            {
              id: "reports",
              label: "Reports",
              icon: BarChart3,
              children: [
                {
                  id: "reports/petty-cash",
                  label: "Petty Cash Transaction Record",
                  icon: History,
                },
                {
                  id: "reports/petty-cash-summary",
                  label: "Petty Cash Summary Report",
                  icon: ClipboardList,
                },
                {
                  id: "reports/overriding-fees",
                  label: "Overriding Fees Report",
                  icon: FileText,
                },
                {
                  id: "reports/performance-report",
                  label: "Performance Report",
                  icon: BarChart3,
                },
                {
                  id: "reports/client-list",
                  label: "List Of Client Report",
                  icon: UserCheck,
                },
                {
                  id: "reports/inv-or-rpt",
                  label: "IN/CN/DN/OR Listing Report",
                  icon: FileText,
                },
                {
                  id: "reports/commission-report",
                  label: "Commission Report",
                  icon: DollarSign,
                  children: [
                    {
                      id: "reports/comm-inv-summary",
                      label: "Payout Invoice Summary",
                      icon: FileText,
                    },
                    {
                      id: "reports/comm-payout",
                      label: "Comm Payout Report",
                      icon: DollarSign,
                    },
                  ],
                },
                {
                  id: "reports/property-transacted",
                  label: "Monthly Property Transacted Report",
                  icon: Building,
                },
                {
                  id: "reports/rens-earning-cp58",
                  label: "Ren's Earning - CP58",
                  icon: FileText,
                },
                {
                  id: "reports/rens-close-ranking",
                  label: "REN's Close on Ranking (monthly/yearly)",
                  icon: Award,
                },
                {
                  id: "reports/rens-com-payout-ranking",
                  label: "REN's Com payout Ranking (monthly/yearly)",
                  icon: TrendingUp,
                },
                {
                  id: "reports/withholding-tax",
                  label: "Withholding Tax",
                  icon: DollarSign,
                },
                {
                  id: "reports/close-on-report",
                  label: "Close on Report (submission date)",
                  icon: Calendar,
                },
                {
                  id: "reports/individual-group-performance",
                  label: "Individual Group Performance (Payout)",
                  icon: Users,
                },
                {
                  id: "reports/individual-group-performance-close-on",
                  label: "Individual Group Performance (Close On)",
                  icon: TrendingUp,
                },
              ],
            },
          ] as MenuItem[])
        : []),

      ...(isAccountUser
        ? ([
            {
              id: "setting",
              label: "Setting",
              icon: Settings,
              children: [
                { id: "setting/country", label: "Country", icon: Globe },
                { id: "setting/project", label: "Project", icon: Briefcase },
                { id: "setting/location", label: "Location", icon: Globe },
              ],
            },
          ] as MenuItem[])
        : []),
    ];

    // ✅ TEMP HIDE HERE (no crash)
    return HIDE_RENTAL_AND_SALES
      ? items.filter((x) => x.id !== "rental" && x.id !== "sale-purchase")
      : items;
  }, [isAccountUser]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    // auto-expand parent if currentPage is a child or sub-child
    menuItems.forEach((item) => {
      // Check level 2
      if (item.children?.some((c) => c.id === currentPage)) {
        setExpanded((prev) => ({ ...prev, [item.id]: true }));
      }

      // Check level 3
      item.children?.forEach((child) => {
        if (child.children?.some((subChild) => subChild.id === currentPage)) {
          setExpanded((prev) => ({
            ...prev,
            [item.id]: true,
            [child.id]: true,
          }));
        }
      });
    });
  }, [currentPage, menuItems]);

  const isItemActive = (item: MenuItem) => {
    if (currentPage === item.id) return true;
    if (item.children?.some((c) => c.id === currentPage)) return true;

    // Check level 3
    return (
      item.children?.some((c) =>
        c.children?.some((sc) => sc.id === currentPage)
      ) ?? false
    );
  };

  const isChildActive = (child: MenuChild) => {
    if (currentPage === child.id) return true;
    return child.children?.some((sc) => sc.id === currentPage) ?? false;
  };

  const handlePageChange = (page: string) => {
    onPageChange(page);
    if (isMobileMenuOpen) toggleMobileMenu();
  };

  const initialLetter = (
    user?.name?.trim()?.charAt(0) || user?.email?.trim()?.charAt(0) || "?"
  ).toUpperCase();

  // ✅ Wallet balance from localStorage (PettyCashAmt) with ##,##0.00 formatting
  const moneyFmt = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const parsePettyCashAmt = (raw: string | null): number => {
    if (!raw) return 0;
    const cleaned = String(raw).replace(/,/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const [walletBalance, setWalletBalance] = useState<number>(() =>
    parsePettyCashAmt(localStorage.getItem("pettyCashAmt"))
  );

  useEffect(() => {
    setWalletBalance(parsePettyCashAmt(localStorage.getItem("pettyCashAmt")));

    const onStorage = (e: StorageEvent) => {
      if (e.key === "pettyCashAmt") {
        setWalletBalance(parsePettyCashAmt(e.newValue));
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ✅ Change Password states
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const getUserNameForPasswordUpdate = (): string => {
    return String(
      localStorage.getItem("userName") ||
        localStorage.getItem("UserName") ||
        localStorage.getItem("username") ||
        localStorage.getItem("LoginUserName") ||
        localStorage.getItem("loginUserName") ||
        user?.name ||
        user?.email ||
        ""
    ).trim();
  };

  const closePasswordModal = () => {
    if (isUpdatingPassword) return;
    setShowChangePasswordModal(false);
    setNewPassword("");
    setShowPassword(false);
    setPasswordError("");
  };

  const handleUpdatePassword = async () => {
    const trimmedPassword = newPassword.trim();

    if (!trimmedPassword) {
      setPasswordError("Password cannot be blank.");
      return;
    }

    const userNameValue = getUserNameForPasswordUpdate();

    if (!userNameValue) {
      setPasswordError("UserName not found.");
      return;
    }

    setPasswordError("");
    setIsUpdatingPassword(true);

    try {
      const formData = new FormData();
      formData.append("UserName", userNameValue);
      formData.append("Psw", trimmedPassword);

      const response = await fetch(CHANGE_PASSWORD_URL, {
        method: "POST",
        body: formData,
      });

      const rawText = await response.text();

      let parsed: any = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        throw new Error(
          parsed?.message ||
            parsed?.msg ||
            parsed?.error ||
            `HTTP ${response.status}`
        );
      }

      const responseText = String(rawText || "").toLowerCase();
      const statusText = String(
        parsed?.status || parsed?.Status || parsed?.result || ""
      ).toLowerCase();
      const messageText = String(
        parsed?.message || parsed?.msg || parsed?.Message || ""
      ).toLowerCase();

      const looksLikeFailure =
        statusText.includes("fail") ||
        statusText.includes("error") ||
        messageText.includes("fail") ||
        messageText.includes("error") ||
        responseText.includes('"status":"fail"') ||
        responseText.includes('"status":"error"');

      if (looksLikeFailure) {
        throw new Error(
          parsed?.message ||
            parsed?.msg ||
            parsed?.error ||
            "Failed to update password."
        );
      }

      closePasswordModal();
      alert("Password updated successfully.");
    } catch (error: any) {
      setPasswordError(error?.message || "Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <>
      <aside
        className={[
          "bg-slate-900 text-white w-[20vw] min-w-[260px] max-w-[360px]",
          "fixed left-0 top-0 bottom-0",
          "overflow-y-auto",
          "transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isMobileMenuOpen
            ? "z-50 translate-x-0"
            : "z-0 -translate-x-full lg:z-auto lg:translate-x-0",
        ].join(" ")}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          {/* Mobile close button */}
          <div className="lg:hidden flex justify-end mb-4">
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="text-white hover:text-gray-300 p-1"
              aria-label="Close menu"
            >
              <X size={24} />
            </button>
          </div>

          {/* User info */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold">{initialLetter}</span>
            </div>

            <div className="min-w-0">
              <p className="text-2xl font-bold text-blue-400 truncate">
                {user?.name || user?.email || "User"}
              </p>

              <p className="text-xs text-slate-400 truncate font-bold">
                Petty Cash : {moneyFmt.format(walletBalance)}
              </p>

              <button
                type="button"
                onClick={() => {
                  setPasswordError("");
                  setNewPassword("");
                  setShowPassword(false);
                  setShowChangePasswordModal(true);
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                <KeyRound size={14} />
                <span>Change Password</span>
              </button>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item);
              const hasChildren = !!item.children?.length;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() =>
                      hasChildren ? toggleExpand(item.id) : handlePageChange(item.id)
                    }
                    className={[
                      "w-full flex items-start justify-between px-4 py-3 rounded-lg transition-all duration-200 text-left",
                      active
                        ? "bg-blue-600 text-white shadow-lg"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white",
                    ].join(" ")}
                    aria-expanded={hasChildren ? !!expanded[item.id] : undefined}
                    aria-controls={hasChildren ? `${item.id}-submenu` : undefined}
                  >
                    <span className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="mt-0.5 shrink-0">
                        <Icon size={20} />
                      </span>

                      <span className="font-medium text-left whitespace-normal break-words leading-snug">
                        {item.label}
                      </span>
                    </span>

                    {hasChildren ? (
                      <span className="shrink-0 mt-0.5">
                        {expanded[item.id] ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                      </span>
                    ) : null}
                  </button>

                  {hasChildren && (expanded[item.id] || active) && (
                    <div id={`${item.id}-submenu`} className="mt-2">
                      <ul className="ml-10 space-y-1">
                        {item.children!.map((child) => {
                          const ChildIcon = child.icon ?? Settings;
                          const childActive = isChildActive(child);
                          const hasSubChildren = !!child.children?.length;

                          return (
                            <li key={child.id}>
                              <button
                                type="button"
                                onClick={() =>
                                  hasSubChildren
                                    ? toggleExpand(child.id)
                                    : handlePageChange(child.id)
                                }
                                aria-current={
                                  childActive && !hasSubChildren ? "page" : undefined
                                }
                                className={[
                                  "w-full flex items-start justify-between px-3 py-2 rounded-md text-left transition-all duration-200",
                                  childActive
                                    ? "bg-blue-600 text-white shadow"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                                ].join(" ")}
                              >
                                <span className="flex items-center space-x-2 flex-1 min-w-0">
                                  <ChildIcon size={18} />
                                  <span className="text-sm">{child.label}</span>
                                </span>

                                {hasSubChildren ? (
                                  <span className="shrink-0">
                                    {expanded[child.id] ? (
                                      <ChevronDown size={16} />
                                    ) : (
                                      <ChevronRight size={16} />
                                    )}
                                  </span>
                                ) : null}
                              </button>

                              {hasSubChildren && (expanded[child.id] || childActive) && (
                                <div id={`${child.id}-submenu`} className="mt-1">
                                  <ul className="ml-8 space-y-1">
                                    {child.children!.map((subChild) => {
                                      const SubChildIcon = subChild.icon ?? FileText;
                                      const subChildActive =
                                        currentPage === subChild.id;

                                      return (
                                        <li key={subChild.id}>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handlePageChange(subChild.id)
                                            }
                                            aria-current={
                                              subChildActive ? "page" : undefined
                                            }
                                            className={[
                                              "w-full flex items-center space-x-2 px-3 py-2 rounded-md text-left transition-all duration-200",
                                              subChildActive
                                                ? "bg-blue-600 text-white shadow"
                                                : "text-slate-300 hover:bg-slate-800 hover:text-white",
                                            ].join(" ")}
                                          >
                                            <SubChildIcon size={16} />
                                            <span className="text-xs">
                                              {subChild.label}
                                            </span>
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button> 

          {/* Version Info */}
          <div className="mt-4 text-center text-xs text-slate-500">
            <p>Version : 1.0.286</p>
            <p>Date : 20-April-26 14:29</p>
          </div>
        </div>
      </aside>

      {/* ✅ Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <KeyRound className="text-blue-600" size={20} />
                <h2 className="text-lg font-bold text-slate-800">
                  Change Password
                </h2>
              </div>

              <button
                type="button"
                onClick={closePasswordModal}
                disabled={isUpdatingPassword}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                New Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleUpdatePassword();
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter new password"
                  autoFocus
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {passwordError ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {passwordError}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={isUpdatingPassword}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUpdatePassword}
                disabled={isUpdatingPassword}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={16} />
                    <span>Update</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;