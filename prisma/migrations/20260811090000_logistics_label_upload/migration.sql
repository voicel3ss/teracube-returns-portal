ALTER TABLE "shipments"
ADD COLUMN "label_filename" TEXT,
ADD COLUMN "label_content_type" TEXT,
ADD COLUMN "label_data" BYTEA;
