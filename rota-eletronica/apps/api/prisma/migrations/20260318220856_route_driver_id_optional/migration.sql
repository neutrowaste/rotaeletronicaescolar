-- DropForeignKey
ALTER TABLE "Route" DROP CONSTRAINT "Route_driver_id_fkey";

-- AlterTable
ALTER TABLE "Route" ALTER COLUMN "driver_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
