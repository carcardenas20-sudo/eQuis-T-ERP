import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const PurchaseItem = base44.asServiceRole.entities.PurchaseItem;
    const Product = base44.asServiceRole.entities.Product;

    // Get all purchase items
    const allItems = await PurchaseItem.list(null, 1000);
    
    let updated = 0;
    let failed = 0;

    for (const item of allItems) {
      // Skip items that already have product_name
      if (item.product_name) continue;

      try {
        // Find product by SKU (product_id field)
        const products = await Product.list(null, 1000);
        const product = products.find(p => p.sku === item.product_id);

        if (product) {
          await PurchaseItem.update(item.id, {
            product_name: product.name
          });
          updated++;
        }
      } catch (err) {
        console.error(`Error updating item ${item.id}:`, err);
        failed++;
      }
    }

    return Response.json({
      success: true,
      message: `Migración completada. Actualizados: ${updated}, Errores: ${failed}`,
      updated,
      failed
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});