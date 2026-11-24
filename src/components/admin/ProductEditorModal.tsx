import { Plus, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  Brand,
  Category,
  Product,
  ProductCondition,
  ProductSpec,
  ProductVariant,
  StockStatus,
} from '../../types/catalog';
import { computeDiscountPercentage } from '../../utils/currency';
import {
  ALLOWED_UPLOAD_IMAGE_TYPES,
  isValidImageSource,
  MAX_UPLOAD_IMAGE_BYTES,
} from '../../utils/url';

interface ProductEditorModalProps {
  initialProduct: Product | null;
  categories: Category[];
  brands: Brand[];
  onSave: (product: Product) => void;
  onClose: () => void;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ProductEditorModal({
  initialProduct,
  categories,
  brands,
  onSave,
  onClose,
}: ProductEditorModalProps) {
  const [name, setName] = useState(initialProduct?.name || '');
  const [slug, setSlug] = useState(initialProduct?.slug || '');
  const [sku, setSku] = useState(initialProduct?.sku || '');
  const [brandId, setBrandId] = useState(initialProduct?.brandId || brands[0]?.id || '');
  const [categoryId, setCategoryId] = useState(
    initialProduct?.categoryId || categories[0]?.id || ''
  );
  const [price, setPrice] = useState<string>(
    initialProduct ? String(initialProduct.price) : ''
  );
  const [originalPrice, setOriginalPrice] = useState<string>(
    initialProduct?.originalPrice ? String(initialProduct.originalPrice) : ''
  );
  const [discountOverride, setDiscountOverride] = useState<string>(
    initialProduct?.discountPercentage ? String(initialProduct.discountPercentage) : ''
  );
  const [stockStatus, setStockStatus] = useState<StockStatus>(
    initialProduct?.stockStatus || 'In Stock'
  );
  const [stockCount, setStockCount] = useState<string>(
    initialProduct ? String(initialProduct.stockCount) : '5'
  );
  const [condition, setCondition] = useState<ProductCondition>(
    initialProduct?.condition || 'Brand New'
  );
  const [featured, setFeatured] = useState<boolean>(initialProduct?.featured ?? false);
  const [published, setPublished] = useState<boolean>(initialProduct?.published ?? true);
  const [shortDescription, setShortDescription] = useState(
    initialProduct?.shortDescription || ''
  );
  const [description, setDescription] = useState(initialProduct?.description || '');
  const [images, setImages] = useState<string[]>(initialProduct?.images || []);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [imageError, setImageError] = useState<string | null>(null);
  const [specs, setSpecs] = useState<ProductSpec[]>(
    initialProduct?.specs.length ? initialProduct.specs : [{ label: '', value: '' }]
  );
  const [whatsInBoxText, setWhatsInBoxText] = useState(
    initialProduct?.whatsInBox.join('\n') || ''
  );
  const [compatibility, setCompatibility] = useState(initialProduct?.compatibility || '');
  const [warrantyInfo, setWarrantyInfo] = useState(
    initialProduct?.warrantyInfo ||
      '14-day TechnHobbies bench-verified DOA inspection coverage.'
  );
  const [shippingInfo, setShippingInfo] = useState(
    initialProduct?.shippingInfo ||
      'Insured nationwide courier dispatch across Pakistan within 24–48 business hours.'
  );
  const [variants, setVariants] = useState<ProductVariant[]>(
    initialProduct?.variants || []
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const numericPrice = Math.max(0, Number(price) || 0);
  const numericOriginal = Number(originalPrice) > 0 ? Number(originalPrice) : undefined;
  const computedDiscount = computeDiscountPercentage(numericPrice, numericOriginal);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImageError(null);
    Array.from(files).forEach((file) => {
      if (!ALLOWED_UPLOAD_IMAGE_TYPES.includes(file.type)) {
        setImageError(`Unsupported format (${file.name}). Allowed: JPEG, PNG, or WebP.`);
        return;
      }
      if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
        setImageError(`Image "${file.name}" exceeds 800 KB limit for local preview storage.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAddImageUrl = () => {
    const trimmed = newImageUrl.trim();
    if (!trimmed) return;
    if (!isValidImageSource(trimmed)) {
      setImageError('Enter a valid http(s):// URL or local /src/assets/ or /assets/ path.');
      return;
    }
    setImageError(null);
    setImages((prev) => [...prev, trimmed]);
    setNewImageUrl('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim() || numericPrice <= 0) return;

    const finalSlug = slug.trim() || slugify(name);
    const cleanSpecs = specs.filter((s) => s.label.trim() && s.value.trim());
    const cleanBox = whatsInBoxText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const cleanVariants = variants.filter((v) => v.label.trim());

    const explicitDiscount = Number(discountOverride);
    const finalDiscount =
      explicitDiscount > 0 ? explicitDiscount : computedDiscount;

    onSave({
      id: initialProduct?.id || `prod-${Date.now()}`,
      slug: finalSlug,
      name: name.trim(),
      brandId,
      categoryId,
      sku: sku.trim().toUpperCase(),
      price: numericPrice,
      originalPrice:
        numericOriginal && numericOriginal > numericPrice ? numericOriginal : undefined,
      discountPercentage: finalDiscount,
      stockStatus,
      stockCount: Math.max(0, Number(stockCount) || 0),
      condition,
      featured,
      published,
      archived: initialProduct?.archived ?? false,
      shortDescription: shortDescription.trim() || name.trim(),
      description: description.trim() || shortDescription.trim(),
      images,
      specs: cleanSpecs,
      whatsInBox: cleanBox,
      compatibility: compatibility.trim() || 'Confirm compatibility via WhatsApp inquiry.',
      warrantyInfo: warrantyInfo.trim(),
      shippingInfo: shippingInfo.trim(),
      variants: cleanVariants,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="font-display text-lg font-bold text-slate-900">
            {initialProduct ? `Edit Product · ${initialProduct.sku}` : 'Add New Product'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Core Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!initialProduct) {
                    setSlug(slugify(e.target.value));
                  }
                }}
                placeholder="e.g. RadioMaster TX16S Mark II ELRS"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SKU *</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="TH-RAD-1602"
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">URL Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="radiomaster-tx16s-mk2"
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* PKR Pricing & Stock */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selling Price (PKR) *
              </label>
              <input
                type="number"
                required
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="18500"
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Original Price (PKR, Optional)
              </label>
              <input
                type="number"
                min={0}
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="21000"
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Discount % (Auto: {computedDiscount ? `${computedDiscount}%` : 'None'})
              </label>
              <input
                type="number"
                min={0}
                max={95}
                value={discountOverride}
                onChange={(e) => setDiscountOverride(e.target.value)}
                placeholder={computedDiscount ? String(computedDiscount) : '0'}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stock Availability
              </label>
              <select
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value as StockStatus)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="In Stock">In Stock</option>
                <option value="Limited Stock">Limited Stock</option>
                <option value="Pre-Order">Pre-Order</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stock Quantity
              </label>
              <input
                type="number"
                min={0}
                value={stockCount}
                onChange={(e) => setStockCount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as ProductCondition)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="Brand New">Brand New</option>
                <option value="Open Box">Open Box</option>
                <option value="Refurbished">Refurbished</option>
              </select>
            </div>
          </div>

          {/* Visibility Toggles */}
          <div className="flex flex-wrap gap-6 pt-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <span>Published on Storefront</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <span>Mark as Featured Product</span>
            </label>
          </div>

          {/* Images Upload & Management */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700">
                Product Images (JPEG, PNG, WebP · max 800 KB)
              </label>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Image File</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {imageError && (
              <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {imageError}
              </p>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Or paste local asset path (/src/assets/...) or https:// URL..."
                className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="px-3 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
              >
                Add Image
              </button>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-[4/3] bg-slate-100 border border-slate-200 rounded-lg overflow-hidden group"
                  >
                    <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove image"
                      className="absolute top-1 right-1 p-1 bg-slate-950/75 text-white rounded hover:bg-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Descriptions */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Summary
              </label>
              <input
                type="text"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="One-line highlight shown on product cards"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Product Description
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description, performance notes, and field capabilities..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {/* Technical Specifications */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Technical Specifications
              </label>
              <button
                type="button"
                onClick={() => setSpecs((prev) => [...prev, { label: '', value: '' }])}
                className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Spec Row</span>
              </button>
            </div>
            <div className="space-y-2">
              {specs.map((spec, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={spec.label}
                    onChange={(e) =>
                      setSpecs((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row))
                      )
                    }
                    placeholder="Spec name (e.g. Motor KV)"
                    className="sm:col-span-5 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    value={spec.value}
                    onChange={(e) =>
                      setSpecs((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, value: e.target.value } : row))
                      )
                    }
                    placeholder="Value (e.g. 2050KV 4-Pole Brushless)"
                    className="sm:col-span-6 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setSpecs((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove spec row"
                    className="sm:col-span-1 p-2 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Variants */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Product Variants (Optional)
              </label>
              <button
                type="button"
                onClick={() =>
                  setVariants((prev) => [
                    ...prev,
                    {
                      id: `var-${Date.now()}`,
                      group: 'Option',
                      label: '',
                      priceDelta: 0,
                      skuSuffix: '',
                      inStock: true,
                    },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Variant</span>
              </button>
            </div>
            {variants.map((variant, idx) => (
              <div key={variant.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={variant.group}
                  onChange={(e) =>
                    setVariants((prev) =>
                      prev.map((v, i) => (i === idx ? { ...v, group: e.target.value } : v))
                    )
                  }
                  placeholder="Group"
                  className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={variant.label}
                  onChange={(e) =>
                    setVariants((prev) =>
                      prev.map((v, i) => (i === idx ? { ...v, label: e.target.value } : v))
                    )
                  }
                  placeholder="Variant Label (e.g. ELRS 2.4GHz)"
                  className="sm:col-span-4 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <input
                  type="number"
                  value={variant.priceDelta}
                  onChange={(e) =>
                    setVariants((prev) =>
                      prev.map((v, i) =>
                        i === idx ? { ...v, priceDelta: Number(e.target.value) || 0 } : v
                      )
                    )
                  }
                  placeholder="+PKR"
                  className="sm:col-span-2 px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={variant.skuSuffix}
                  onChange={(e) =>
                    setVariants((prev) =>
                      prev.map((v, i) => (i === idx ? { ...v, skuSuffix: e.target.value } : v))
                    )
                  }
                  placeholder="-ELRS"
                  className="sm:col-span-2 px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
                <label className="sm:col-span-1 inline-flex items-center gap-1 text-[11px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={variant.inStock}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((v, i) => (i === idx ? { ...v, inStock: e.target.checked } : v))
                      )
                    }
                    className="rounded border-slate-300 text-orange-600"
                  />
                  <span>Stock</span>
                </label>
                <button
                  type="button"
                  onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Remove variant"
                  className="sm:col-span-1 p-1.5 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Box Contents, Compatibility, Warranty, Shipping */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                What&apos;s Included in Box (1 item per line)
              </label>
              <textarea
                rows={3}
                value={whatsInBoxText}
                onChange={(e) => setWhatsInBoxText(e.target.value)}
                placeholder="Main Unit&#10;Transmitter&#10;Manual"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Compatibility Information
              </label>
              <textarea
                rows={3}
                value={compatibility}
                onChange={(e) => setCompatibility(e.target.value)}
                placeholder="Supported LiPo cells, connectors, or receivers..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Warranty Information
              </label>
              <input
                type="text"
                value={warrantyInfo}
                onChange={(e) => setWarrantyInfo(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shipping &amp; Dispatch Info
              </label>
              <input
                type="text"
                value={shippingInfo}
                onChange={(e) => setShippingInfo(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              {initialProduct ? 'Save Product Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
