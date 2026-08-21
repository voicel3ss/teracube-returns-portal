UPDATE devices
SET circulation_state = 'in_transfer'
WHERE serial IN (
  SELECT shipment_units.device_serial
  FROM shipment_units
  INNER JOIN shipments ON shipments.id = shipment_units.shipment_id
  WHERE shipments.type = 'internal_transfer'
    AND shipments.status IN ('created', 'label_ready', 'in_transit', 'exception')
);
