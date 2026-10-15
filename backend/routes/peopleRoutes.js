const express = require("express");
const {
  uploadProfileImage,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
  listStaffGrades,
  createStaffGrade,
  updateStaffGrade,
  updateStaffGradeStatus,
  listUsers,
  createUser,
  updateUser,
  updateUserStatus,
  listMembers,
  createMember,
  updateMember,
  updateMemberStatus,
  listStaffs,
  createStaff,
  updateStaff,
  updateStaffStatus,
} = require("../modules/people/peopleController");

const { requireAccess, requireSelfOrAdmin } = require("../utils/accessPolicy");

const router = express.Router();

router.post("/people/profile-image", requireAccess("authenticated"), uploadProfileImage);
router.get("/people/staff-grades", requireAccess("viewPeople"), listStaffGrades);
router.post("/people/staff-grades", requireAccess("managePeople"), createStaffGrade);
router.put("/people/staff-grades/:id", requireAccess("managePeople"), updateStaffGrade);
router.patch("/people/staff-grades/:id/status", requireAccess("managePeople"), updateStaffGradeStatus);

router.get("/people/users", requireAccess("viewPeople"), listUsers);
router.get("/people/users/:id/profile", requireSelfOrAdmin, getUserProfile);
router.post("/people/users", requireAccess("managePeople"), createUser);
router.put("/people/users/:id", requireAccess("managePeople"), updateUser);
router.put("/people/users/:id/profile", requireSelfOrAdmin, updateUserProfile);
router.patch("/people/users/:id/password", requireSelfOrAdmin, changeUserPassword);
router.patch("/people/users/:id/status", requireAccess("managePeople"), updateUserStatus);

router.get("/people/members", requireAccess("viewPeople"), listMembers);
router.post("/people/members", requireAccess("managePeople"), createMember);
router.put("/people/members/:id", requireAccess("managePeople"), updateMember);
router.patch("/people/members/:id/status", requireAccess("managePeople"), updateMemberStatus);

router.get("/people/staffs", requireAccess("backOffice"), listStaffs);
router.post("/people/staffs", requireAccess("managePeople"), createStaff);
router.put("/people/staffs/:id", requireAccess("managePeople"), updateStaff);
router.patch("/people/staffs/:id/status", requireAccess("managePeople"), updateStaffStatus);

module.exports = router;
