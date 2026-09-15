import { config } from '../config/app';
import Admin, { AdminRole } from '../models/adminModel';
import { hash } from '../utils/hash';

const UtilServices = {
  superSignup: async () => {
    try {
      const firstName = config.app.ADMIN_NAME;
      const lastName = config.app.ADMIN_NAME;
      const email = config.app.ADMIN_EMAIL;
      const password = config.app.ADMIN_PASS;      

      if (!email || !password) return;

      const exist = await Admin.findOne({ email });
      if (exist) return;

      const hashedPassword = await hash(password as string);

      await Admin.create({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: AdminRole.SUPER_ADMIN
      });
    } catch (error: any) {
      throw new Error(error.message || 'App Startup Error');
    }
  },
};

export default UtilServices
