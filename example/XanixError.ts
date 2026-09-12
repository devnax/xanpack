class XanixRedirect extends Error {
  status: any;
  location: any;
  constructor(status: any, location: any) {
    super("XANIX_REDIRECT");
    this.status = status;
    this.location = location;
  }
}

export default XanixRedirect;
