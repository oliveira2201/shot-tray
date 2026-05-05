export interface TrayOrder {
  id: number;
  status: string;
  status_id: number;
  customer: { name: string; cellphone?: string; phone?: string; email?: string };
  shipment_value?: number;
  total?: number;
  tracking_code?: string;
  tracking_url?: string;
  link_payment?: string;
  link_track?: string;
  Order?: any;
  [k: string]: any;
}
