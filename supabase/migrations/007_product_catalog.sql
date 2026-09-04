-- Product catalog and reusable brand profile

CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL DEFAULT '',
  website_url TEXT,
  description TEXT,
  target_audience TEXT,
  brand_voice TEXT,
  brand_values TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  approved_claims TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  prohibited_claims TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_profile_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  brand_name TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  benefits TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ingredients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  price TEXT,
  offer TEXT,
  product_url TEXT,
  approved_claims TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  prohibited_claims TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  packshots TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  primary_packshot TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_active ON products(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_brand_profile_id ON products(brand_profile_id);

CREATE TABLE IF NOT EXISTS product_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  asset_role TEXT NOT NULL DEFAULT 'packshot'
    CHECK (asset_role IN ('packshot', 'lifestyle', 'detail')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_product_assets_product_id ON product_assets(product_id);

ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY brand_profiles_select_own ON brand_profiles FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY brand_profiles_insert_own ON brand_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY brand_profiles_update_own ON brand_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY brand_profiles_delete_own ON brand_profiles FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY products_select_own ON products FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY products_insert_own ON products FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      brand_profile_id IS NULL
      OR EXISTS (
        SELECT 1 FROM brand_profiles bp
        WHERE bp.id = brand_profile_id AND bp.user_id = auth.uid()
      )
    )
  );
CREATE POLICY products_update_own ON products FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      brand_profile_id IS NULL
      OR EXISTS (
        SELECT 1 FROM brand_profiles bp
        WHERE bp.id = brand_profile_id AND bp.user_id = auth.uid()
      )
    )
  );
CREATE POLICY products_delete_own ON products FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY product_assets_metadata_select_own ON product_assets FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY product_assets_metadata_insert_own ON product_assets FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM products p WHERE p.id = product_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY product_assets_metadata_update_own ON product_assets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY product_assets_metadata_delete_own ON product_assets FOR DELETE
  USING (auth.uid() = user_id);

-- Public assets are stored under product-assets/<user-id>/...
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-assets', 'product-assets', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('creative-assets', 'creative-assets', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY product_assets_select ON storage.objects FOR SELECT
  USING (bucket_id = 'product-assets');
CREATE POLICY product_assets_insert_own ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-assets'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
CREATE POLICY product_assets_update_own ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-assets'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'product-assets'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
CREATE POLICY product_assets_delete_own ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-assets'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY creative_assets_select ON storage.objects FOR SELECT
  USING (bucket_id = 'creative-assets');
CREATE POLICY creative_assets_insert_own ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'creative-assets'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
CREATE POLICY creative_assets_update_own ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'creative-assets'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'creative-assets'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
CREATE POLICY creative_assets_delete_own ON storage.objects FOR DELETE
  USING (
    bucket_id = 'creative-assets'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
