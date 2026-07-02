import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, Trash2, ShieldAlert, CheckCircle, Loader2, 
  ArrowLeft, Search, Scan, X, Calendar, DollarSign, Percent 
} from "lucide-react";
import { getInventorySuppliers, getInventoryProducts, createGRN } from "../services/api";

const fmtLKR = (n) =>
  `Rs. ${Number(n || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function ReceiveGRN() {
  const navigate = useNavigate();

  // Master Data
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Loading & Feedback
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form State
  const [supplierId, setSupplierId] = useState("");
  const [grnNumber, setGrnNumber] = useState("");
  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().substring(0, 10)
  );
  
  const [items, setItems] = useState([
    {
      product_id: "",
      purchase_cost: "",
      ops_cost: "",
      margin: "0",
      is_custom_override: false,
      custom_price_override: "",
      serial_numbers: [],
      quantity: 1,
      is_serialized: false,
      calculated_final_price: 0,
      model_name: ""
    }
  ]);

  // Serial Number Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [serialInput, setSerialInput] = useState("");
  const serialInputRef = useRef(null);

  // Load Suppliers and Product Catalog on mount
  useEffect(() => {
    Promise.all([getInventorySuppliers(), getInventoryProducts()])
      .then(([suppliersData, productsData]) => {
        setSuppliers(suppliersData || []);
        setProducts(productsData || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load inventory data:", err);
        setError("Could not load suppliers or product catalog details. Please check the backend connection.");
        setLoading(false);
      });
  }, []);

  // Utility to calculate price live in UI
  const calculateLivePrice = (purchase, ops, marginPct, isOverride, overrideVal) => {
    if (isOverride) {
      return Number(overrideVal || 0);
    }
    const base = Number(purchase || 0) + Number(ops || 0);
    const profit = base * (Number(marginPct || 0) / 100);
    const afterMargin = base + profit;
    const sscl = afterMargin * 0.025;
    const vat = (afterMargin + sscl) * 0.18;
    return Number((afterMargin + sscl + vat).toFixed(2));
  };

  // Add a new row to GRN line items
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        product_id: "",
        purchase_cost: "",
        ops_cost: "",
        margin: "0",
        is_custom_override: false,
        custom_price_override: "",
        serial_numbers: [],
        quantity: 1,
        is_serialized: false,
        calculated_final_price: 0,
        model_name: ""
      }
    ]);
  };

  // Remove a row from GRN line items
  const handleRemoveItem = (index) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  // Update fields on a line item
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === "product_id") {
      const selectedProd = products.find((p) => p.id === Number(value));
      if (selectedProd) {
        item.product_id = value;
        item.is_serialized = selectedProd.is_serialized;
        item.model_name = `${selectedProd.brand} ${selectedProd.model}`;
        
        // Reset serial numbers and quantity based on whether it is serialized
        item.serial_numbers = [];
        item.quantity = selectedProd.is_serialized ? 0 : 1;
      } else {
        item.product_id = "";
        item.is_serialized = false;
        item.model_name = "";
        item.serial_numbers = [];
        item.quantity = 1;
      }
    } else {
      item[field] = value;
    }

    // Live update final calculated price
    item.calculated_final_price = calculateLivePrice(
      item.purchase_cost,
      item.ops_cost,
      item.margin,
      item.is_custom_override,
      item.custom_price_override
    );

    updated[index] = item;
    setItems(updated);
  };

  // Opens the Serial Number Input Modal for a specific row
  const openSerialModal = (index) => {
    setActiveItemIndex(index);
    setSerialInput("");
    setModalOpen(true);
    // Focus the input field after render
    setTimeout(() => {
      if (serialInputRef.current) {
        serialInputRef.current.focus();
      }
    }, 100);
  };

  // Add serial number scanned/entered in modal
  const handleAddSerial = (e) => {
    e.preventDefault();
    const cleanSerial = serialInput.trim();
    if (!cleanSerial) return;

    const updated = [...items];
    const item = { ...updated[activeItemIndex] };

    // Prevent duplicate serial entries in the same row
    if (item.serial_numbers.includes(cleanSerial)) {
      alert("This serial number is already scanned for this product line.");
      setSerialInput("");
      return;
    }

    // Add to serial list and update quantity
    item.serial_numbers = [...item.serial_numbers, cleanSerial];
    item.quantity = item.serial_numbers.length;

    // Recalculate price
    item.calculated_final_price = calculateLivePrice(
      item.purchase_cost,
      item.ops_cost,
      item.margin,
      item.is_custom_override,
      item.custom_price_override
    );

    updated[activeItemIndex] = item;
    setItems(updated);
    setSerialInput("");

    // Keep input field focused for continuous scanner inputs
    if (serialInputRef.current) {
      serialInputRef.current.focus();
    }
  };

  // Remove a serial from modal list
  const handleRemoveSerial = (serialIndex) => {
    const updated = [...items];
    const item = { ...updated[activeItemIndex] };
    const cleanSerials = [...item.serial_numbers];
    cleanSerials.splice(serialIndex, 1);
    
    item.serial_numbers = cleanSerials;
    item.quantity = cleanSerials.length;

    updated[activeItemIndex] = item;
    setItems(updated);
  };

  // Submit form data
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic Header Validations
    if (!supplierId) {
      setError("Please select a Supplier.");
      return;
    }
    if (!grnNumber.trim()) {
      setError("Please enter a GRN Number.");
      return;
    }

    // Item Validations & Payload Formatting
    const formattedItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id) {
        setError(`Row ${i + 1}: Please select a product.`);
        return;
      }
      if (Number(item.purchase_cost || 0) <= 0) {
        setError(`Row ${i + 1}: Unit Cost must be greater than 0.`);
        return;
      }

      if (item.is_serialized) {
        if (!item.serial_numbers || item.serial_numbers.length === 0) {
          setError(`Row ${i + 1}: "${item.model_name}" is serialized. Please scan/enter at least one serial number.`);
          return;
        }
      }

      // Convert quantity to matching length null-filled array for non-serialized bulk items
      let serials = [];
      if (item.is_serialized) {
        serials = item.serial_numbers;
      } else {
        const qty = Number(item.quantity || 1);
        if (qty <= 0) {
          setError(`Row ${i + 1}: Quantity must be at least 1 for bulk items.`);
          return;
        }
        serials = Array(qty).fill(null);
      }

      formattedItems.push({
        product_id: Number(item.product_id),
        purchase_cost: Number(item.purchase_cost),
        ops_cost: Number(item.ops_cost || 0),
        margin: Number(item.margin || 0),
        is_custom_override: item.is_custom_override,
        custom_price_override: item.is_custom_override ? Number(item.custom_price_override) : null,
        serial_numbers: serials
      });
    }

    const payload = {
      supplier_id: Number(supplierId),
      grn_number: grnNumber.trim(),
      received_date: receivedDate,
      received_items: formattedItems
    };

    setSubmitting(true);
    try {
      const res = await createGRN(payload);
      setSuccess(`GRN ${res.grn_number} created successfully! Total Cost: ${fmtLKR(res.total_cost)}`);
      // Reset form on success
      setSupplierId("");
      setGrnNumber("");
      setItems([
        {
          product_id: "",
          purchase_cost: "",
          ops_cost: "",
          margin: "0",
          is_custom_override: false,
          custom_price_override: "",
          serial_numbers: [],
          quantity: 1,
          is_serialized: false,
          calculated_final_price: 0,
          model_name: ""
        }
      ]);
      // Scroll to top to see success alert
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("GRN submission error:", err);
      const errMsg = err.response?.data?.detail || "An error occurred while saving the GRN. Verify that the GRN number and serial numbers are globally unique.";
      setError(errMsg);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <span className="text-sm font-medium text-slate-500">Loading catalog and supplier directories...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Back to Dashboard Link */}
      <button
        onClick={() => navigate("/dashboard")}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </button>

      {/* Header Info */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Receive Stock (Goods Receipt Note)</h1>
        <p className="mt-1 text-sm text-slate-500">
          Intake catalog inventory from suppliers and compute base/VAT/selling price configurations.
        </p>
      </div>

      {/* Message Notifications */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <h4 className="font-semibold text-red-900">GRN Validation Failure</h4>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 shadow-sm">
          <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
          <div>
            <h4 className="font-semibold text-emerald-900">Stock Successfully Logged</h4>
            <p className="mt-1 text-sm text-emerald-700">{success}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Panel 1: Document Metadata */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">1. Document Metadata</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {/* Supplier Picker */}
            <div>
              <label htmlFor="supplier" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Supplier
              </label>
              <select
                id="supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Choose Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.contact_person ? `(${s.contact_person})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* GRN Number Input */}
            <div>
              <label htmlFor="grnNumber" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                GRN Reference Number
              </label>
              <input
                id="grnNumber"
                type="text"
                value={grnNumber}
                onChange={(e) => setGrnNumber(e.target.value)}
                placeholder="e.g. GRN-2026-008"
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Date Received */}
            <div>
              <label htmlFor="receivedDate" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Date Received
              </label>
              <div className="relative mt-2">
                <input
                  id="receivedDate"
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Product Breakdown Array */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">2. Received Inventory Line Items</h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" /> Add Product to GRN
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 min-w-[220px]">Product (Catalog Template)</th>
                  <th className="px-4 py-3 w-[120px]">Unit Cost (Purchase)</th>
                  <th className="px-4 py-3 w-[110px]">Ops Cost</th>
                  <th className="px-4 py-3 w-[100px]">Margin %</th>
                  <th className="px-4 py-3 w-[130px]">Pricing Logic</th>
                  <th className="px-4 py-3 w-[120px]">Final Price (LKR)</th>
                  <th className="px-4 py-3 w-[100px]">Quantity</th>
                  <th className="px-4 py-3 w-[160px] text-center">Serials / Tracker</th>
                  <th className="px-4 py-3 w-[60px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/50">
                    {/* Product Selection */}
                    <td className="px-4 py-3">
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(index, "product_id", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">-- Choose Product --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.category}] {p.brand} {p.model} {p.is_serialized ? "(Serialized)" : ""}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Unit Cost */}
                    <td className="px-4 py-3">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">Rs.</span>
                        <input
                          type="number"
                          value={item.purchase_cost}
                          onChange={(e) => handleItemChange(index, "purchase_cost", e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-2 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </td>

                    {/* Ops Cost */}
                    <td className="px-4 py-3">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">Rs.</span>
                        <input
                          type="number"
                          value={item.ops_cost}
                          onChange={(e) => handleItemChange(index, "ops_cost", e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-2 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </td>

                    {/* Margin */}
                    <td className="px-4 py-3">
                      <div className="relative">
                        <input
                          type="number"
                          value={item.margin}
                          onChange={(e) => handleItemChange(index, "margin", e.target.value)}
                          min="0"
                          step="0.1"
                          disabled={item.is_custom_override}
                          className="w-full rounded-lg border border-slate-300 py-1.5 pl-2 pr-6 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">%</span>
                      </div>
                    </td>

                    {/* Override Standard Math Toggle */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={item.is_custom_override}
                            onChange={(e) => handleItemChange(index, "is_custom_override", e.target.checked)}
                            className="peer sr-only"
                          />
                          <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-focus:outline-none"></div>
                        </label>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Custom Price</span>
                      </div>
                    </td>

                    {/* Live Calculated Selling Price OR Custom Override input */}
                    <td className="px-4 py-3">
                      {item.is_custom_override ? (
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">Rs.</span>
                          <input
                            type="number"
                            value={item.custom_price_override}
                            onChange={(e) => handleItemChange(index, "custom_price_override", e.target.value)}
                            placeholder="Final Price"
                            min="0"
                            step="0.01"
                            className="w-full rounded-lg border border-blue-500 py-1.5 pl-8 pr-2 text-xs font-semibold text-blue-700 bg-blue-50 shadow-sm focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div className="px-2 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 text-right">
                          {fmtLKR(item.calculated_final_price)}
                        </div>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                        disabled={item.is_serialized}
                        min="1"
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:font-medium text-center"
                      />
                    </td>

                    {/* Serial scanning actions */}
                    <td className="px-4 py-3 text-center">
                      {item.is_serialized ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openSerialModal(index)}
                            className="flex items-center gap-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 text-[11px] font-bold border border-blue-200 shadow-sm transition"
                          >
                            <Scan className="h-3 w-3" /> Scan Serials
                          </button>
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {item.serial_numbers.length} units scanned
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Bulk (Unserialized)</span>
                      )}
                    </td>

                    {/* Remove Action Button */}
                    <td className="px-4 py-3 text-center">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-700 p-1 transition"
                          title="Delete row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex items-center justify-end gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              "Log Goods Receipt Note"
            )}
          </button>
        </div>
      </form>

      {/* Serial Number Scanner/Input Modal */}
      {modalOpen && activeItemIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Scan Serial Numbers</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Product: {items[activeItemIndex]?.model_name || "Unknown Product"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Serial Entry Form (Scanner Friendly) */}
            <form onSubmit={handleAddSerial} className="mt-4">
              <label htmlFor="serialEntry" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Scan or Type Serial Number & Press Enter
              </label>
              <div className="relative mt-2 flex gap-2">
                <input
                  id="serialEntry"
                  type="text"
                  ref={serialInputRef}
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  placeholder="e.g. SN-89230514-A"
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  Add
                </button>
              </div>
            </form>

            {/* Scanned Serial Numbers List */}
            <div className="mt-6">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>Scanned Serials ({items[activeItemIndex]?.serial_numbers?.length || 0})</span>
                {items[activeItemIndex]?.serial_numbers?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Clear all scanned serial numbers?")) {
                        handleItemChange(activeItemIndex, "serial_numbers", []);
                      }
                    }}
                    className="text-red-500 hover:text-red-600 normal-case"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2 divide-y divide-slate-200">
                {items[activeItemIndex]?.serial_numbers?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Scan className="h-8 w-8 stroke-1 text-slate-300" />
                    <span className="text-xs mt-2">No serial numbers scanned yet.</span>
                  </div>
                ) : (
                  items[activeItemIndex].serial_numbers.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 px-3 text-xs text-slate-800">
                      <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                        {s}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSerial(idx)}
                        className="text-red-500 hover:text-red-700 p-0.5 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 text-xs font-semibold shadow"
              >
                Close & Save ({items[activeItemIndex]?.serial_numbers?.length || 0})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
